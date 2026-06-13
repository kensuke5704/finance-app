import type { MomentumMonthlyRow, MomentumTickerSeed } from "./momentumData";

export type MarketState = "RiskOn" | "Cash";

export type MomentumSettings = {
  topN: number;
  spikeLimit: number;
  genreLimits: Record<string, number>;
  frontierGenres: string[];
  frontierLimit: number;
};

export type MomentumCandidate = {
  symbol: string;
  genre: string;
  current: number;
  return1m: number;
  return3m: number;
  return6m: number;
  score: number;
  eligible: boolean;
  rank: number;
  selected: boolean;
  blockedReason?: string;
};

export type MomentumPortfolioRow = MomentumCandidate & {
  targetAmount: number;
  targetShares: number;
  actualShares: number;
  actualAmount: number;
  differenceAmount: number;
  differenceShares: number;
};

export type MomentumSnapshot = {
  date: string;
  market: MarketState;
  qqqScore: number | null;
  qqqPrice: number | null;
  qqqMovingAverage10m: number | null;
  candidates: MomentumCandidate[];
  picks: MomentumCandidate[];
};

export type MomentumBacktestRow = {
  date: string;
  nextDate: string;
  market: MarketState;
  picks: string[];
  monthlyReturn: number;
  equity: number;
  drawdown: number;
};

export type MomentumBacktestResult = {
  startMonth: string;
  endMonth: string;
  rows: MomentumBacktestRow[];
  finalEquity: number;
  cagr: number;
  averageMonthlyReturn: number;
  monthlyVolatility: number;
  annualizedVolatility: number;
  maxDrawdown: number;
};

export const DEFAULT_MOMENTUM_SETTINGS: MomentumSettings = {
  topN: 10,
  spikeLimit: 0.8,
  genreLimits: {
    Quantum: 2,
    "AI Semi": 2,
    Space: 2,
  },
  frontierGenres: ["Quantum", "Space", "Nuclear", "Crypto"],
  frontierLimit: 4,
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getPrice(row: MomentumMonthlyRow | undefined, symbol: string) {
  if (!row) return null;
  const value = row.prices[symbol];
  return isFiniteNumber(value) && value > 0 ? value : null;
}

function calcReturn(rows: MomentumMonthlyRow[], rowIndex: number, symbol: string, months: number) {
  const current = getPrice(rows[rowIndex], symbol);
  const past = getPrice(rows[rowIndex - months], symbol);
  if (current === null || past === null || past === 0) return null;
  return current / past - 1;
}

function calcScore(return1m: number, return3m: number, return6m: number) {
  return return1m * 0.2 + return3m * 0.4 + return6m * 0.4;
}

export function calcMarketState(rows: MomentumMonthlyRow[], rowIndex: number): {
  market: MarketState;
  qqqPrice: number | null;
  movingAverage10m: number | null;
} {
  const qqqPrice = getPrice(rows[rowIndex], "QQQ");
  const window = rows
    .slice(Math.max(0, rowIndex - 9), rowIndex + 1)
    .map((row) => getPrice(row, "QQQ"))
    .filter(isFiniteNumber);

  if (qqqPrice === null || window.length < 10) {
    return { market: "Cash", qqqPrice, movingAverage10m: null };
  }

  const movingAverage10m = window.reduce((sum, value) => sum + value, 0) / window.length;
  return {
    market: qqqPrice > movingAverage10m ? "RiskOn" : "Cash",
    qqqPrice,
    movingAverage10m,
  };
}

export function calculateMomentumSnapshot(params: {
  rows: MomentumMonthlyRow[];
  tickers: MomentumTickerSeed[];
  rowIndex?: number;
  enabledSymbols?: Set<string>;
  settings?: MomentumSettings;
}): MomentumSnapshot {
  const { rows, tickers } = params;
  const settings = params.settings ?? DEFAULT_MOMENTUM_SETTINGS;
  const rowIndex = params.rowIndex ?? rows.length - 1;
  const enabledSymbols = params.enabledSymbols ?? new Set(tickers.map((ticker) => ticker.symbol));
  const marketState = calcMarketState(rows, rowIndex);

  const qqqReturn1m = calcReturn(rows, rowIndex, "QQQ", 1);
  const qqqReturn3m = calcReturn(rows, rowIndex, "QQQ", 3);
  const qqqReturn6m = calcReturn(rows, rowIndex, "QQQ", 6);
  const qqqScore =
    qqqReturn1m === null || qqqReturn3m === null || qqqReturn6m === null
      ? null
      : calcScore(qqqReturn1m, qqqReturn3m, qqqReturn6m);

  const rawCandidates = tickers.flatMap((ticker) => {
    if (ticker.symbol === "QQQ" || !enabledSymbols.has(ticker.symbol)) return [];
    const current = getPrice(rows[rowIndex], ticker.symbol);
    const return1m = calcReturn(rows, rowIndex, ticker.symbol, 1);
    const return3m = calcReturn(rows, rowIndex, ticker.symbol, 3);
    const return6m = calcReturn(rows, rowIndex, ticker.symbol, 6);
    if (
      current === null ||
      return1m === null ||
      return3m === null ||
      return6m === null ||
      qqqScore === null
    ) {
      return [];
    }

    const score = calcScore(return1m, return3m, return6m);
    return [
      {
        symbol: ticker.symbol,
        genre: ticker.genre,
        current,
        return1m,
        return3m,
        return6m,
        score,
        eligible: score > qqqScore && return1m < settings.spikeLimit,
        rank: 0,
        selected: false,
      },
    ];
  });

  const candidates = rawCandidates
    .sort((a, b) => b.score - a.score)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));

  const genreCounts: Record<string, number> = {};
  let frontierCount = 0;
  const picks: MomentumCandidate[] = [];
  const frontierSet = new Set(settings.frontierGenres);

  const candidatesWithSelection = candidates.map((candidate) => {
    if (marketState.market !== "RiskOn") {
      return { ...candidate, selected: false, blockedReason: "RiskOff" };
    }
    if (!candidate.eligible) {
      const reason = candidate.return1m >= settings.spikeLimit ? "急騰除外" : "QQQ以下";
      return { ...candidate, selected: false, blockedReason: reason };
    }

    const genreLimit = settings.genreLimits[candidate.genre] ?? Number.POSITIVE_INFINITY;
    const nextGenreCount = (genreCounts[candidate.genre] ?? 0) + 1;
    if (nextGenreCount > genreLimit) {
      return { ...candidate, selected: false, blockedReason: `${candidate.genre}上限` };
    }

    const isFrontier = frontierSet.has(candidate.genre);
    if (isFrontier && frontierCount + 1 > settings.frontierLimit) {
      return { ...candidate, selected: false, blockedReason: "frontier上限" };
    }

    if (picks.length >= settings.topN) {
      return { ...candidate, selected: false, blockedReason: "上位10件外" };
    }

    genreCounts[candidate.genre] = nextGenreCount;
    if (isFrontier) frontierCount += 1;
    const selected = { ...candidate, selected: true };
    picks.push(selected);
    return selected;
  });

  return {
    date: rows[rowIndex]?.date ?? "",
    market: marketState.market,
    qqqScore,
    qqqPrice: marketState.qqqPrice,
    qqqMovingAverage10m: marketState.movingAverage10m,
    candidates: candidatesWithSelection,
    picks,
  };
}

export function buildPortfolioRows(params: {
  snapshot: MomentumSnapshot;
  targetTotalUsd: number;
  actualShares: Record<string, number>;
}): MomentumPortfolioRow[] {
  const targetAmount =
    params.snapshot.picks.length > 0 ? params.targetTotalUsd / params.snapshot.picks.length : 0;
  return params.snapshot.picks.map((pick) => {
    const actualShares = params.actualShares[pick.symbol] ?? 0;
    const actualAmount = actualShares * pick.current;
    const targetShares = pick.current > 0 ? Math.floor(targetAmount / pick.current) : 0;
    return {
      ...pick,
      targetAmount,
      targetShares,
      actualShares,
      actualAmount,
      differenceAmount: actualAmount - targetAmount,
      differenceShares: actualShares - targetShares,
    };
  });
}

function annualizeCagr(finalEquity: number, rows: MomentumBacktestRow[]) {
  if (rows.length === 0 || finalEquity <= 0) return 0;
  const years = rows.length / 12;
  return Math.pow(finalEquity, 1 / years) - 1;
}

function standardDeviation(values: number[]) {
  if (values.length <= 1) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function runMomentumBacktest(params: {
  rows: MomentumMonthlyRow[];
  tickers: MomentumTickerSeed[];
  startMonth: string;
  enabledSymbols?: Set<string>;
  settings?: MomentumSettings;
}): MomentumBacktestResult {
  const { rows, tickers, startMonth } = params;
  const settings = params.settings ?? DEFAULT_MOMENTUM_SETTINGS;
  const enabledSymbols = params.enabledSymbols ?? new Set(tickers.map((ticker) => ticker.symbol));
  const backtestRows: MomentumBacktestRow[] = [];
  let equity = 1;
  let peak = 1;

  for (let rowIndex = 10; rowIndex < rows.length - 1; rowIndex += 1) {
    const row = rows[rowIndex];
    if (row.date.slice(0, 7) < startMonth) continue;

    const snapshot = calculateMomentumSnapshot({ rows, tickers, rowIndex, enabledSymbols, settings });
    const nextRow = rows[rowIndex + 1];
    let monthlyReturn = 0;

    if (snapshot.market === "RiskOn" && snapshot.picks.length >= settings.topN) {
      const returns = snapshot.picks
        .map((pick) => {
          const current = getPrice(row, pick.symbol);
          const next = getPrice(nextRow, pick.symbol);
          if (current === null || next === null || current === 0) return null;
          return next / current - 1;
        })
        .filter(isFiniteNumber);
      monthlyReturn =
        returns.length > 0 ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0;
    }

    equity *= 1 + monthlyReturn;
    peak = Math.max(peak, equity);
    const drawdown = peak > 0 ? equity / peak - 1 : 0;
    backtestRows.push({
      date: row.date,
      nextDate: nextRow.date,
      market: snapshot.market,
      picks: snapshot.picks.map((pick) => pick.symbol),
      monthlyReturn,
      equity,
      drawdown,
    });
  }

  const returns = backtestRows.map((row) => row.monthlyReturn);
  const finalEquity = equity;
  const averageMonthlyReturn =
    returns.length > 0 ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0;
  const monthlyVolatility = standardDeviation(returns);

  return {
    startMonth,
    endMonth: backtestRows.length > 0 ? backtestRows[backtestRows.length - 1].date.slice(0, 7) : startMonth,
    rows: backtestRows,
    finalEquity,
    cagr: annualizeCagr(finalEquity, backtestRows),
    averageMonthlyReturn,
    monthlyVolatility,
    annualizedVolatility: monthlyVolatility * Math.sqrt(12),
    maxDrawdown: backtestRows.reduce((min, row) => Math.min(min, row.drawdown), 0),
  };
}
