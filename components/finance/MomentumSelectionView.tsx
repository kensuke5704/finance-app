"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MOMENTUM_EXTRA_TICKERS } from "../../lib/momentumExtraTickers";
import {
  MOMENTUM_MONTHLY_ROWS,
  MOMENTUM_TICKERS,
  type MomentumMonthlyRow,
  type MomentumTickerSeed,
} from "../../lib/momentumData";
import {
  buildPortfolioRows,
  calculateMomentumSnapshot,
  DEFAULT_MOMENTUM_SETTINGS,
  runMomentumBacktest,
  type MomentumBacktestRow,
  type MomentumCandidate,
} from "../../lib/momentumEngine";
import { fetchLatestMarketPrice } from "./financeUtils";

const ENABLED_STORAGE_KEY = "finance.momentum.enabledSymbols.v1";
const CUSTOM_TICKERS_STORAGE_KEY = "finance.momentum.customTickers.v1";
const ACTUAL_SHARES_STORAGE_KEY = "finance.momentum.actualShares.v1";
const TARGET_TOTAL_STORAGE_KEY = "finance.momentum.targetTotalUsd.v1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const DEFAULT_TICKERS = [...MOMENTUM_TICKERS, ...MOMENTUM_EXTRA_TICKERS];

type ViewMode = "portfolio" | "candidates" | "backtest";
type CandidateJudge = "採用中" | "強い削除候補" | "削除候補" | "非Eligible" | "低順位" | "維持候補";

export type MomentumPickForSync = {
  symbol: string;
  current: number;
};

type MomentumSelectionViewProps = {
  onPicksChange?: (picks: MomentumPickForSync[]) => void;
};

type CandidateRow = MomentumTickerSeed & {
  enabled: boolean;
  current?: MomentumCandidate;
  selected: boolean;
  recentPickCount: number;
  lastPicked: string;
  judge: CandidateJudge;
};

const percentFormatter = new Intl.NumberFormat("ja-JP", { style: "percent", maximumFractionDigits: 1 });
const numberFormatter = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 });
const integerFormatter = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });

function publicAssetPath(path: string) {
  return `${basePath}${path.startsWith("/") ? path : `/${path}`}`;
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return percentFormatter.format(value);
}

function formatNumber(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("ja-JP", {
    minimumFractionDigits: digits === 1 ? 1 : 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatInteger(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return integerFormatter.format(Math.round(value));
}

function parseNumericInput(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function isValidMonthlyRows(value: unknown): value is MomentumMonthlyRow[] {
  return Array.isArray(value) && value.length >= 10 && value.every((row) => row && typeof row === "object" && typeof (row as MomentumMonthlyRow).date === "string" && (row as MomentumMonthlyRow).prices && typeof (row as MomentumMonthlyRow).prices === "object");
}

function monthOptions(rows: MomentumMonthlyRow[]) {
  const latest = rows[rows.length - 1]?.date.slice(0, 7) ?? "";
  const latestIndex = rows.findIndex((row) => row.date.slice(0, 7) === latest);
  const last12Index = Math.max(0, latestIndex - 11);
  const last36Index = Math.max(0, latestIndex - 35);
  const last60Index = Math.max(0, latestIndex - 59);
  return [
    { label: "2023/1〜現在", value: "2023-01" },
    { label: "2024/1〜現在", value: "2024-01" },
    { label: "直近12か月", value: rows[last12Index]?.date.slice(0, 7) ?? "2023-01" },
    { label: "直近36か月", value: rows[last36Index]?.date.slice(0, 7) ?? "2023-01" },
    { label: "直近60か月", value: rows[last60Index]?.date.slice(0, 7) ?? "2023-01" },
  ];
}

function mergeTickers(...groups: MomentumTickerSeed[][]) {
  const map = new Map<string, MomentumTickerSeed>();
  groups.flat().forEach((ticker) => {
    const symbol = ticker.symbol.trim().toUpperCase();
    if (!symbol || symbol === "QQQ") return;
    map.set(symbol, { symbol, genre: ticker.genre.trim() || "Other" });
  });
  return Array.from(map.values());
}

function subtractMonths(monthOrDate: string, months: number) {
  const [year, month] = monthOrDate.slice(0, 7).split("-").map(Number);
  const date = new Date(year, month - 1 - months, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function countRecentPicks(rows: MomentumBacktestRow[], symbol: string, cutoffMonth: string) {
  return rows.filter((row) => row.date.slice(0, 7) >= cutoffMonth && row.picks.includes(symbol)).length;
}

function findLastPicked(rows: MomentumBacktestRow[], symbol: string) {
  const hit = rows.slice().reverse().find((row) => row.picks.includes(symbol));
  return hit?.date.slice(0, 7) ?? "";
}

function judgeCandidate(params: { selected: boolean; recentPickCount: number; current?: MomentumCandidate }): CandidateJudge {
  const { selected, recentPickCount, current } = params;
  if (selected) return "採用中";
  if (recentPickCount === 0) return "強い削除候補";
  if (recentPickCount <= 2) return "削除候補";
  if (!current?.eligible) return "非Eligible";
  if ((current?.rank ?? 999) > 20) return "低順位";
  return "維持候補";
}

function candidateTone(judge: CandidateJudge) {
  if (judge === "採用中") return "selected";
  return "neutral";
}

export default function MomentumSelectionView({ onPicksChange }: MomentumSelectionViewProps) {
  const [startMonth, setStartMonth] = useState("2023-01");
  const [targetTotalUsd, setTargetTotalUsd] = useState(6500);
  const [targetTotalDraft, setTargetTotalDraft] = useState("6,500");
  const [monthlyRows, setMonthlyRows] = useState<MomentumMonthlyRow[]>(MOMENTUM_MONTHLY_ROWS);
  const [enabledSymbols, setEnabledSymbols] = useState<Set<string>>(() => new Set(DEFAULT_TICKERS.map((ticker) => ticker.symbol)));
  const [customTickers, setCustomTickers] = useState<MomentumTickerSeed[]>([]);
  const [actualShares, setActualShares] = useState<Record<string, number>>({});
  const [jsonPrices, setJsonPrices] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<ViewMode>("portfolio");
  const [deleteVisibleSymbols, setDeleteVisibleSymbols] = useState<Set<string>>(new Set());
  const longPressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadMonthlyRows() {
      try {
        const response = await fetch(`${publicAssetPath("/momentum-monthly.json")}?ts=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) return;
        const json = await response.json();
        if (!cancelled && isValidMonthlyRows(json)) setMonthlyRows(json);
      } catch {}
    }
    void loadMonthlyRows();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const storedEnabled = readJson<string[] | null>(ENABLED_STORAGE_KEY, null);
    const storedCustom = readJson<MomentumTickerSeed[]>(CUSTOM_TICKERS_STORAGE_KEY, []);
    const storedActual = readJson<Record<string, number>>(ACTUAL_SHARES_STORAGE_KEY, {});
    const storedTarget = readJson<number>(TARGET_TOTAL_STORAGE_KEY, 6500);
    setCustomTickers(storedCustom);
    setActualShares(storedActual);
    if (storedEnabled) {
      setEnabledSymbols(new Set([...storedEnabled, ...MOMENTUM_EXTRA_TICKERS.map((ticker) => ticker.symbol)]));
    }
    if (typeof storedTarget === "number" && Number.isFinite(storedTarget)) {
      setTargetTotalUsd(storedTarget);
      setTargetTotalDraft(formatInteger(storedTarget));
    }
  }, []);

  useEffect(() => writeJson(ENABLED_STORAGE_KEY, Array.from(enabledSymbols)), [enabledSymbols]);
  useEffect(() => writeJson(CUSTOM_TICKERS_STORAGE_KEY, customTickers), [customTickers]);
  useEffect(() => writeJson(ACTUAL_SHARES_STORAGE_KEY, actualShares), [actualShares]);
  useEffect(() => writeJson(TARGET_TOTAL_STORAGE_KEY, targetTotalUsd), [targetTotalUsd]);

  const tickers = useMemo(() => mergeTickers(MOMENTUM_TICKERS, MOMENTUM_EXTRA_TICKERS, customTickers), [customTickers]);
  const latestSnapshot = useMemo(() => calculateMomentumSnapshot({ rows: monthlyRows, tickers, enabledSymbols, settings: DEFAULT_MOMENTUM_SETTINGS }), [enabledSymbols, monthlyRows, tickers]);
  const portfolioRows = useMemo(() => buildPortfolioRows({ snapshot: latestSnapshot, targetTotalUsd, actualShares }), [actualShares, latestSnapshot, targetTotalUsd]);
  const fullBacktest = useMemo(() => runMomentumBacktest({ rows: monthlyRows, tickers, startMonth: "2023-01", enabledSymbols, settings: DEFAULT_MOMENTUM_SETTINGS }), [enabledSymbols, monthlyRows, tickers]);
  const backtest = useMemo(() => runMomentumBacktest({ rows: monthlyRows, tickers, startMonth, enabledSymbols, settings: DEFAULT_MOMENTUM_SETTINGS }), [enabledSymbols, monthlyRows, startMonth, tickers]);
  const options = useMemo(() => monthOptions(monthlyRows), [monthlyRows]);
  const selectedSymbols = useMemo(() => new Set(latestSnapshot.picks.map((pick) => pick.symbol)), [latestSnapshot.picks]);

  useEffect(() => {
    let cancelled = false;
    const symbols = Array.from(new Set(latestSnapshot.picks.map((pick) => pick.symbol)));
    async function loadJsonPrices() {
      const entries = await Promise.all(symbols.map(async (symbol) => {
        const price = await fetchLatestMarketPrice(symbol);
        return [symbol, typeof price === "number" && Number.isFinite(price) && price > 0 ? price : undefined] as const;
      }));
      const validEntries = entries.filter((entry): entry is readonly [string, number] => typeof entry[1] === "number");
      if (!cancelled) setJsonPrices((current) => ({ ...current, ...Object.fromEntries(validEntries) }));
    }
    void loadJsonPrices();
    return () => { cancelled = true; };
  }, [latestSnapshot.picks]);

  const displayPortfolioRows = useMemo(() => portfolioRows.map((row) => {
    const basisPrice = row.current;
    const cachedPrice = jsonPrices[row.symbol];
    const current = typeof cachedPrice === "number" && cachedPrice > 0 ? cachedPrice : row.current;
    const targetAmount = row.targetAmount;
    const actual = actualShares[row.symbol] ?? row.actualShares;
    const targetShares = current > 0 ? Number((targetAmount / current).toFixed(1)) : row.targetShares;
    return { ...row, basisPrice, current, targetShares, actualShares: actual, actualAmount: actual * current, differenceAmount: actual * current - targetAmount, differenceShares: actual - targetShares };
  }), [actualShares, jsonPrices, portfolioRows]);

  useEffect(() => {
    if (!onPicksChange || latestSnapshot.picks.length === 0) return;
    const syncedPicks = latestSnapshot.picks.map((pick) => ({ symbol: pick.symbol, current: jsonPrices[pick.symbol] || pick.current }));
    if (syncedPicks.some((pick) => !pick.current)) return;
    onPicksChange(syncedPicks);
  }, [jsonPrices, latestSnapshot.picks, onPicksChange]);

  const candidateRows = useMemo<CandidateRow[]>(() => {
    const cutoffMonth = subtractMonths(latestSnapshot.date, 24);
    return tickers.map((ticker) => {
      const current = latestSnapshot.candidates.find((candidate) => candidate.symbol === ticker.symbol);
      const selected = selectedSymbols.has(ticker.symbol);
      const recentPickCount = countRecentPicks(fullBacktest.rows, ticker.symbol, cutoffMonth);
      const lastPicked = findLastPicked(fullBacktest.rows, ticker.symbol);
      const judge = judgeCandidate({ selected, recentPickCount, current });
      return { ...ticker, enabled: enabledSymbols.has(ticker.symbol), current, selected, recentPickCount, lastPicked, judge };
    });
  }, [enabledSymbols, fullBacktest.rows, latestSnapshot.candidates, latestSnapshot.date, selectedSymbols, tickers]);

  const enabledCount = tickers.filter((ticker) => enabledSymbols.has(ticker.symbol)).length;
  const latestDate = latestSnapshot.date;
  const visibleCandidateRows = candidateRows.filter((row) => row.enabled);

  function updateActualShares(symbol: string, value: string) {
    const parsed = Number(value);
    setActualShares((prev) => ({ ...prev, [symbol]: Number.isFinite(parsed) ? parsed : 0 }));
  }

  function startCandidateLongPress(symbol: string) {
    if (typeof window === "undefined") return;
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      setDeleteVisibleSymbols((current) => new Set(current).add(symbol));
      longPressTimerRef.current = null;
    }, 520);
  }

  function cancelCandidateLongPress() {
    if (!longPressTimerRef.current || typeof window === "undefined") return;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }

  function removeCandidate(symbol: string) {
    if (!window.confirm(`${symbol}を候補から削除しますか？`)) return;
    setEnabledSymbols((prev) => {
      const next = new Set(prev);
      next.delete(symbol);
      return next;
    });
    setDeleteVisibleSymbols((current) => {
      const next = new Set(current);
      next.delete(symbol);
      return next;
    });
  }

  return (
    <section
      className="stack momentum-selection-view"
      onPointerDown={(event) => {
        const target = event.target;
        if (target instanceof Element && !target.closest(".momentum-candidate-card")) {
          setDeleteVisibleSymbols(new Set());
        }
      }}
    >
      <div className="kpis mini momentum-kpis">
        <div className="kpi"><div className="kpi-label">Market</div><div className="kpi-value">{latestSnapshot.market}</div></div>
        <div className="kpi"><div className="kpi-label">基準日</div><div className="kpi-value">{latestDate}</div></div>
        <div className="kpi"><div className="kpi-label">候補銘柄</div><div className="kpi-value">{enabledCount}件</div></div>
      </div>

      <section className="panel">
        <div className="panel-body stack momentum-main-body">
          <div className="chart-tabs" role="tablist" aria-label="Momentumメニュー">
            {[["portfolio", "投資対象"], ["candidates", "候補管理"], ["backtest", "検証"]].map(([key, label]) => <button key={key} type="button" className={`chart-tab ${mode === key ? "active" : ""}`} onClick={() => setMode(key as ViewMode)}>{label}</button>)}
          </div>

          {mode === "portfolio" && (
            <div className="stack compact-stack">
              <div className="month-select-grid momentum-target-grid">
                <label className="field">
                  <span className="label">投資総額（USD）</span>
                  <input className="input" inputMode="numeric" value={targetTotalDraft} onChange={(event) => { setTargetTotalDraft(event.target.value); setTargetTotalUsd(parseNumericInput(event.target.value)); }} onBlur={() => setTargetTotalDraft(formatInteger(targetTotalUsd))} />
                </label>
                <div className="field"><span className="label">QQQ / 10M MA</span><div className="readonly-box compact-box"><b>{formatNumber(latestSnapshot.qqqPrice)} / {formatNumber(latestSnapshot.qqqMovingAverage10m)}</b></div></div>
              </div>

              {latestSnapshot.market !== "RiskOn" ? <div className="empty-state">現在はCash判定です。新規投資対象はありません。</div> : (
                <div className="momentum-card-list">
                  {displayPortfolioRows.map((row) => (
                    <article className="momentum-pick-card" key={row.symbol}>
                      <div className="momentum-pick-head"><div className="momentum-pick-title-block"><div className="momentum-rank-badge">Rank {row.rank}</div><div className="momentum-title-row"><h3>{row.symbol}</h3></div></div></div>
                      <div className="momentum-metric-grid portfolio-metric-grid">
                        <div><span>基準値</span><b>{formatNumber(row.basisPrice, 1)}</b></div>
                        <div><span>現在値</span><b>{formatNumber(row.current, 1)}</b></div>
                        <div><span>Score</span><b>{formatNumber(row.score, 3)}</b></div>
                        <div><span>1M</span><b>{formatPercent(row.return1m)}</b></div>
                        <div><span>3M</span><b>{formatPercent(row.return3m)}</b></div>
                        <div><span>6M</span><b>{formatPercent(row.return6m)}</b></div>
                        <div className="share-ratio-box"><span>株数</span><b>(<input className="momentum-share-inline-input" inputMode="decimal" value={row.actualShares || ""} onChange={(event) => updateActualShares(row.symbol, event.target.value)} />)/{formatNumber(row.targetShares, 1)}</b></div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === "candidates" && (
            <div className="momentum-candidate-list">
              {visibleCandidateRows.map((row) => (
                <div key={row.symbol} className={`momentum-candidate-card ${candidateTone(row.judge)} ${deleteVisibleSymbols.has(row.symbol) ? "show-delete" : ""}`} onMouseDown={() => startCandidateLongPress(row.symbol)} onMouseUp={cancelCandidateLongPress} onMouseLeave={cancelCandidateLongPress} onTouchStart={() => startCandidateLongPress(row.symbol)} onTouchEnd={cancelCandidateLongPress} onTouchCancel={cancelCandidateLongPress}>
                  {deleteVisibleSymbols.has(row.symbol) && <button className="candidate-delete-button" type="button" onClick={() => removeCandidate(row.symbol)}>×</button>}
                  <b>{row.symbol}</b><span>{row.genre}</span>
                </div>
              ))}
            </div>
          )}

          {mode === "backtest" && (
            <div className="stack compact-stack">
              <div className="month-select-grid momentum-target-grid">
                <label className="field"><span className="label">開始時期</span><select className="input" value={startMonth} onChange={(event) => setStartMonth(event.target.value)}>{options.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}</select></label>
                <div className="field"><span className="label">検証期間</span><div className="readonly-box compact-box"><b>{backtest.startMonth}〜{backtest.endMonth}</b></div></div>
              </div>
              <div className="kpis mini momentum-backtest-kpis">
                <div className="kpi"><div className="kpi-label">Final Equity</div><div className="kpi-value">{formatPercent(backtest.finalEquity - 1)}</div></div>
                <div className="kpi"><div className="kpi-label">CAGR</div><div className="kpi-value">{formatPercent(backtest.cagr)}</div></div>
                <div className="kpi"><div className="kpi-label">Max DD</div><div className="kpi-value negative">{formatPercent(backtest.maxDrawdown)}</div></div>
                <div className="kpi"><div className="kpi-label">平均月利</div><div className="kpi-value">{formatPercent(backtest.averageMonthlyReturn)}</div></div>
                <div className="kpi"><div className="kpi-label">月次Vol</div><div className="kpi-value">{formatPercent(backtest.monthlyVolatility)}</div></div>
                <div className="kpi"><div className="kpi-label">年率Vol</div><div className="kpi-value">{formatPercent(backtest.annualizedVolatility)}</div></div>
              </div>
              <div className="momentum-history-list">
                {backtest.rows.slice().reverse().map((row) => <article className="momentum-history-card" key={row.date}><div className="momentum-history-head"><div><h3>{row.date}</h3><p>{row.market}</p></div><b className={row.monthlyReturn >= 0 ? "positive" : "negative"}>{formatPercent(row.monthlyReturn)}</b></div><div className="chip-row compact-chip-row">{row.picks.length > 0 ? row.picks.map((pick) => <span className="chip" key={pick}>{pick}</span>) : <span className="chip">Cash</span>}</div><div className="momentum-candidate-detail two-items"><div><span>Equity</span><b>{numberFormatter.format(row.equity)}</b></div><div><span>DD</span><b className="negative">{formatPercent(row.drawdown)}</b></div></div></article>)}
              </div>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
