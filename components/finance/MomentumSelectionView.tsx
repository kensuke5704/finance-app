"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MOMENTUM_CANDIDATE_SUGGESTIONS,
  MOMENTUM_MONTHLY_ROWS,
  MOMENTUM_TICKERS,
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

const ENABLED_STORAGE_KEY = "finance.momentum.enabledSymbols.v1";
const CUSTOM_TICKERS_STORAGE_KEY = "finance.momentum.customTickers.v1";
const ACTUAL_SHARES_STORAGE_KEY = "finance.momentum.actualShares.v1";
const TARGET_TOTAL_STORAGE_KEY = "finance.momentum.targetTotalUsd.v1";

type ViewMode = "portfolio" | "candidates" | "backtest";

type DeleteJudge =
  | "採用中"
  | "強い削除候補"
  | "削除候補"
  | "非Eligible"
  | "低順位"
  | "維持候補"
  | "基準銘柄";

type CandidateRuleRow = MomentumTickerSeed & {
  enabled: boolean;
  current?: MomentumCandidate;
  selected: boolean;
  recentPickCount: number;
  lastPicked: string;
  judge: DeleteJudge;
  custom: boolean;
};

const percentFormatter = new Intl.NumberFormat("ja-JP", {
  style: "percent",
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 2,
});

const usdFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return percentFormatter.format(value);
}

function formatNumber(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: digits }).format(value);
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

function monthOptions() {
  const latest = MOMENTUM_MONTHLY_ROWS[MOMENTUM_MONTHLY_ROWS.length - 1]?.date.slice(0, 7) ?? "";
  const latestIndex = MOMENTUM_MONTHLY_ROWS.findIndex((row) => row.date.slice(0, 7) === latest);
  const last12Index = Math.max(0, latestIndex - 11);
  const last36Index = Math.max(0, latestIndex - 35);
  const last60Index = Math.max(0, latestIndex - 59);
  return [
    { label: "2023/1〜現在", value: "2023-01" },
    { label: "2024/1〜現在", value: "2024-01" },
    { label: "直近12か月", value: MOMENTUM_MONTHLY_ROWS[last12Index]?.date.slice(0, 7) ?? "2023-01" },
    { label: "直近36か月", value: MOMENTUM_MONTHLY_ROWS[last36Index]?.date.slice(0, 7) ?? "2023-01" },
    { label: "直近60か月", value: MOMENTUM_MONTHLY_ROWS[last60Index]?.date.slice(0, 7) ?? "2023-01" },
  ];
}

function mergeTickers(base: MomentumTickerSeed[], custom: MomentumTickerSeed[]) {
  const map = new Map<string, MomentumTickerSeed>();
  [...base, ...custom].forEach((ticker) => {
    const symbol = ticker.symbol.trim().toUpperCase();
    if (!symbol) return;
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

function judgeCandidate(params: {
  symbol: string;
  selected: boolean;
  recentPickCount: number;
  current?: MomentumCandidate;
}): DeleteJudge {
  const { symbol, selected, recentPickCount, current } = params;
  if (symbol === "QQQ") return "基準銘柄";
  if (selected) return "採用中";
  if (recentPickCount === 0) return "強い削除候補";
  if (recentPickCount <= 2) return "削除候補";
  if (!current?.eligible) return "非Eligible";
  if ((current?.rank ?? 999) > 20) return "低順位";
  return "維持候補";
}

function judgeTone(judge: DeleteJudge) {
  if (judge === "採用中") return "positive";
  if (judge === "強い削除候補" || judge === "削除候補") return "negative";
  return "muted";
}

export default function MomentumSelectionView() {
  const [startMonth, setStartMonth] = useState("2023-01");
  const [targetTotalUsd, setTargetTotalUsd] = useState(6500);
  const [enabledSymbols, setEnabledSymbols] = useState<Set<string>>(
    () => new Set(MOMENTUM_TICKERS.map((ticker) => ticker.symbol)),
  );
  const [customTickers, setCustomTickers] = useState<MomentumTickerSeed[]>([]);
  const [actualShares, setActualShares] = useState<Record<string, number>>({});
  const [draftSymbol, setDraftSymbol] = useState("");
  const [draftGenre, setDraftGenre] = useState("");
  const [mode, setMode] = useState<ViewMode>("portfolio");

  useEffect(() => {
    const storedEnabled = readJson<string[] | null>(ENABLED_STORAGE_KEY, null);
    const storedCustom = readJson<MomentumTickerSeed[]>(CUSTOM_TICKERS_STORAGE_KEY, []);
    const storedActual = readJson<Record<string, number>>(ACTUAL_SHARES_STORAGE_KEY, {});
    const storedTarget = readJson<number>(TARGET_TOTAL_STORAGE_KEY, 6500);

    setCustomTickers(storedCustom);
    setActualShares(storedActual);
    if (storedEnabled) setEnabledSymbols(new Set(storedEnabled));
    if (typeof storedTarget === "number" && Number.isFinite(storedTarget)) {
      setTargetTotalUsd(storedTarget);
    }
  }, []);

  useEffect(() => writeJson(ENABLED_STORAGE_KEY, Array.from(enabledSymbols)), [enabledSymbols]);
  useEffect(() => writeJson(CUSTOM_TICKERS_STORAGE_KEY, customTickers), [customTickers]);
  useEffect(() => writeJson(ACTUAL_SHARES_STORAGE_KEY, actualShares), [actualShares]);
  useEffect(() => writeJson(TARGET_TOTAL_STORAGE_KEY, targetTotalUsd), [targetTotalUsd]);

  const tickers = useMemo(() => mergeTickers(MOMENTUM_TICKERS, customTickers), [customTickers]);
  const latestSnapshot = useMemo(
    () =>
      calculateMomentumSnapshot({
        rows: MOMENTUM_MONTHLY_ROWS,
        tickers,
        enabledSymbols,
        settings: DEFAULT_MOMENTUM_SETTINGS,
      }),
    [enabledSymbols, tickers],
  );
  const portfolioRows = useMemo(
    () => buildPortfolioRows({ snapshot: latestSnapshot, targetTotalUsd, actualShares }),
    [actualShares, latestSnapshot, targetTotalUsd],
  );
  const fullBacktest = useMemo(
    () =>
      runMomentumBacktest({
        rows: MOMENTUM_MONTHLY_ROWS,
        tickers,
        startMonth: "2023-01",
        enabledSymbols,
        settings: DEFAULT_MOMENTUM_SETTINGS,
      }),
    [enabledSymbols, tickers],
  );
  const backtest = useMemo(
    () =>
      runMomentumBacktest({
        rows: MOMENTUM_MONTHLY_ROWS,
        tickers,
        startMonth,
        enabledSymbols,
        settings: DEFAULT_MOMENTUM_SETTINGS,
      }),
    [enabledSymbols, startMonth, tickers],
  );
  const options = useMemo(() => monthOptions(), []);
  const selectedSymbols = useMemo(
    () => new Set(latestSnapshot.picks.map((pick) => pick.symbol)),
    [latestSnapshot.picks],
  );
  const candidateRows = useMemo<CandidateRuleRow[]>(() => {
    const cutoffMonth = subtractMonths(latestSnapshot.date, 24);
    return tickers.map((ticker) => {
      const current = latestSnapshot.candidates.find((candidate) => candidate.symbol === ticker.symbol);
      const selected = selectedSymbols.has(ticker.symbol);
      const recentPickCount = countRecentPicks(fullBacktest.rows, ticker.symbol, cutoffMonth);
      const lastPicked = findLastPicked(fullBacktest.rows, ticker.symbol);
      const judge = judgeCandidate({ symbol: ticker.symbol, selected, recentPickCount, current });
      return {
        ...ticker,
        enabled: enabledSymbols.has(ticker.symbol),
        current,
        selected,
        recentPickCount,
        lastPicked,
        judge,
        custom: customTickers.some((item) => item.symbol === ticker.symbol),
      };
    });
  }, [customTickers, enabledSymbols, fullBacktest.rows, latestSnapshot.candidates, latestSnapshot.date, selectedSymbols, tickers]);
  const deleteCandidates = candidateRows.filter(
    (row) => row.judge === "強い削除候補" || row.judge === "削除候補",
  );

  const enabledCount = tickers.filter((ticker) => enabledSymbols.has(ticker.symbol)).length;
  const latestDate = latestSnapshot.date;

  function toggleSymbol(symbol: string) {
    setEnabledSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  }

  function addTicker(symbol: string, genre: string) {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const normalizedGenre = genre.trim();
    if (!normalizedSymbol || !normalizedGenre) return;
    setCustomTickers((prev) => mergeTickers(prev, [{ symbol: normalizedSymbol, genre: normalizedGenre }]));
    setEnabledSymbols((prev) => new Set(prev).add(normalizedSymbol));
    setDraftSymbol("");
    setDraftGenre("");
  }

  function removeCustomTicker(symbol: string) {
    setCustomTickers((prev) => prev.filter((ticker) => ticker.symbol !== symbol));
    setEnabledSymbols((prev) => {
      const next = new Set(prev);
      next.delete(symbol);
      return next;
    });
  }

  function updateActualShares(symbol: string, value: string) {
    const parsed = Number(value);
    setActualShares((prev) => ({
      ...prev,
      [symbol]: Number.isFinite(parsed) ? parsed : 0,
    }));
  }

  return (
    <section className="stack momentum-selection-view">
      <div className="kpis mini momentum-kpis">
        <div className="kpi">
          <div className="kpi-label">Market</div>
          <div className="kpi-value">{latestSnapshot.market}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">基準月</div>
          <div className="kpi-value">{latestDate}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">候補銘柄</div>
          <div className="kpi-value">{enabledCount}件</div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-body stack momentum-main-body">
          <div className="chart-tabs" role="tablist" aria-label="Momentumメニュー">
            {[
              ["portfolio", "投資対象"],
              ["candidates", "候補管理"],
              ["backtest", "検証"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`chart-tab ${mode === key ? "active" : ""}`}
                onClick={() => setMode(key as ViewMode)}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "portfolio" && (
            <div className="stack compact-stack">
              <div className="month-select-grid momentum-target-grid">
                <label className="field">
                  <span className="label">投資総額（USD）</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={targetTotalUsd}
                    onChange={(event) => setTargetTotalUsd(Number(event.target.value) || 0)}
                  />
                </label>
                <div className="field">
                  <span className="label">QQQ / 10M MA</span>
                  <div className="readonly-box compact-box">
                    <b>{formatNumber(latestSnapshot.qqqPrice)} / {formatNumber(latestSnapshot.qqqMovingAverage10m)}</b>
                  </div>
                </div>
              </div>

              {latestSnapshot.market !== "RiskOn" ? (
                <div className="empty-state">現在はCash判定です。新規投資対象はありません。</div>
              ) : (
                <div className="momentum-card-list">
                  {portfolioRows.map((row) => (
                    <article className="momentum-pick-card" key={row.symbol}>
                      <div className="momentum-pick-head">
                        <div>
                          <div className="momentum-rank-badge">Rank {row.rank}</div>
                          <h3>{row.symbol}</h3>
                          <p>{row.genre}</p>
                        </div>
                        <div className="momentum-price-block">
                          <span>Current</span>
                          <b>{formatNumber(row.current)}</b>
                        </div>
                      </div>

                      <div className="momentum-metric-grid">
                        <div><span>1M</span><b>{formatPercent(row.return1m)}</b></div>
                        <div><span>3M</span><b>{formatPercent(row.return3m)}</b></div>
                        <div><span>6M</span><b>{formatPercent(row.return6m)}</b></div>
                        <div><span>Score</span><b>{formatNumber(row.score, 3)}</b></div>
                      </div>

                      <div className="momentum-trade-grid">
                        <div className="readonly-box compact-box"><span className="mini-label">目標株数</span><b>{row.targetShares}</b></div>
                        <label className="actual-input-box compact-box">
                          <span className="mini-label">保有株数</span>
                          <input
                            className="input momentum-share-input"
                            type="number"
                            value={row.actualShares}
                            onChange={(event) => updateActualShares(row.symbol, event.target.value)}
                          />
                        </label>
                        <div className="readonly-box compact-box"><span className="mini-label">差分株数</span><b className={row.differenceShares >= 0 ? "positive" : "negative"}>{row.differenceShares > 0 ? "+" : ""}{row.differenceShares}</b></div>
                        <div className="readonly-box compact-box"><span className="mini-label">差分金額</span><b className={row.differenceAmount >= 0 ? "positive" : "negative"}>{usdFormatter.format(row.differenceAmount)}</b></div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === "candidates" && (
            <div className="stack compact-stack">
              <div className="momentum-candidate-summary">
                <div className="result-card deposit compact-result">
                  <span>削除候補</span>
                  <b>{deleteCandidates.length}件</b>
                </div>
                <div className="result-card compact-result">
                  <span>採用中</span>
                  <b>{portfolioRows.length}件</b>
                </div>
              </div>

              <div className="panel candidate-add-panel">
                <div className="panel-body compact-add-body">
                  <div className="month-select-grid compact-input-grid">
                    <label className="field">
                      <span className="label">Ticker</span>
                      <input
                        className="input"
                        value={draftSymbol}
                        placeholder="例: SMCI"
                        onChange={(event) => setDraftSymbol(event.target.value.toUpperCase())}
                      />
                    </label>
                    <label className="field">
                      <span className="label">Genre</span>
                      <input
                        className="input"
                        value={draftGenre}
                        placeholder="例: AI Server"
                        onChange={(event) => setDraftGenre(event.target.value)}
                      />
                    </label>
                  </div>
                  <button className="btn primary compact-action" type="button" onClick={() => addTicker(draftSymbol, draftGenre)}>
                    候補に追加
                  </button>
                  <div className="chip-row compact-chip-row">
                    {MOMENTUM_CANDIDATE_SUGGESTIONS.map((ticker) => (
                      <button
                        key={ticker.symbol}
                        className="btn momentum-suggestion-button"
                        type="button"
                        onClick={() => addTicker(ticker.symbol, ticker.genre)}
                      >
                        {ticker.symbol}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="momentum-candidate-list">
                {candidateRows.map((row) => (
                  <article className={`momentum-candidate-card ${row.enabled ? "enabled" : "disabled"}`} key={row.symbol}>
                    <div className="momentum-candidate-main">
                      <label className="momentum-switch">
                        <input
                          type="checkbox"
                          checked={row.enabled}
                          onChange={() => toggleSymbol(row.symbol)}
                        />
                        <span>{row.enabled ? "ON" : "OFF"}</span>
                      </label>
                      <div>
                        <h3>{row.symbol}</h3>
                        <p>{row.genre}</p>
                      </div>
                      <span className={`momentum-judge ${judgeTone(row.judge)}`}>{row.judge}</span>
                    </div>
                    <div className="momentum-candidate-detail">
                      <div><span>Rank</span><b>{row.current?.rank ?? "-"}</b></div>
                      <div><span>Score</span><b>{formatNumber(row.current?.score, 3)}</b></div>
                      <div><span>Eligible</span><b>{row.current?.eligible ? "1" : "0"}</b></div>
                      <div><span>2Y採用</span><b>{row.recentPickCount}回</b></div>
                    </div>
                    {row.custom && (
                      <div className="momentum-card-actions">
                        <button className="btn danger" type="button" onClick={() => removeCustomTicker(row.symbol)}>
                          削除
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}

          {mode === "backtest" && (
            <div className="stack compact-stack">
              <div className="month-select-grid momentum-target-grid">
                <label className="field">
                  <span className="label">開始時期</span>
                  <select className="input" value={startMonth} onChange={(event) => setStartMonth(event.target.value)}>
                    {options.map((option) => (
                      <option key={option.label} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <div className="field">
                  <span className="label">検証期間</span>
                  <div className="readonly-box compact-box"><b>{backtest.startMonth}〜{backtest.endMonth}</b></div>
                </div>
              </div>

              <div className="kpis mini momentum-backtest-kpis">
                <div className="kpi">
                  <div className="kpi-label">Final Equity</div>
                  <div className="kpi-value">{formatPercent(backtest.finalEquity - 1)}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">CAGR</div>
                  <div className="kpi-value">{formatPercent(backtest.cagr)}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Max DD</div>
                  <div className="kpi-value negative">{formatPercent(backtest.maxDrawdown)}</div>
                </div>
              </div>

              <div className="kpis mini momentum-backtest-kpis">
                <div className="kpi">
                  <div className="kpi-label">平均月利</div>
                  <div className="kpi-value">{formatPercent(backtest.averageMonthlyReturn)}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">月次Vol</div>
                  <div className="kpi-value">{formatPercent(backtest.monthlyVolatility)}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">年率Vol</div>
                  <div className="kpi-value">{formatPercent(backtest.annualizedVolatility)}</div>
                </div>
              </div>

              <div className="momentum-history-list">
                {backtest.rows.slice().reverse().map((row) => (
                  <article className="momentum-history-card" key={row.date}>
                    <div className="momentum-history-head">
                      <div>
                        <h3>{row.date}</h3>
                        <p>{row.market}</p>
                      </div>
                      <b className={row.monthlyReturn >= 0 ? "positive" : "negative"}>{formatPercent(row.monthlyReturn)}</b>
                    </div>
                    <div className="chip-row compact-chip-row">
                      {row.picks.length > 0 ? row.picks.map((pick) => <span className="chip" key={pick}>{pick}</span>) : <span className="chip">Cash</span>}
                    </div>
                    <div className="momentum-candidate-detail two-items">
                      <div><span>Equity</span><b>{numberFormatter.format(row.equity)}</b></div>
                      <div><span>DD</span><b className="negative">{formatPercent(row.drawdown)}</b></div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
