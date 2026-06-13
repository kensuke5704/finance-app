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
} from "../../lib/momentumEngine";

const ENABLED_STORAGE_KEY = "finance.momentum.enabledSymbols.v1";
const CUSTOM_TICKERS_STORAGE_KEY = "finance.momentum.customTickers.v1";
const ACTUAL_SHARES_STORAGE_KEY = "finance.momentum.actualShares.v1";
const TARGET_TOTAL_STORAGE_KEY = "finance.momentum.targetTotalUsd.v1";

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
  const [mode, setMode] = useState<"portfolio" | "candidates" | "backtest">("portfolio");

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
      <div className="kpis mini">
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
        <div className="panel-head compact-head">
          <div>
            <div className="panel-title">Momentum 選定</div>
            <p className="subtitle">
              QQQ 10か月移動平均でRisk判定し、Score = 1M×0.2 + 3M×0.4 + 6M×0.4で上位を抽出します。
            </p>
          </div>
          <span className="badge">frontier 最大4銘柄</span>
        </div>
        <div className="panel-body stack">
          <div className="chart-tabs" role="tablist" aria-label="Momentumメニュー">
            {[
              ["portfolio", "投資対象"],
              ["candidates", "候補管理"],
              ["backtest", "バックテスト"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`chart-tab ${mode === key ? "active" : ""}`}
                onClick={() => setMode(key as typeof mode)}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "portfolio" && (
            <div className="stack">
              <div className="month-select-grid">
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
                  <div className="readonly-box">
                    <b>
                      {formatNumber(latestSnapshot.qqqPrice)} / {formatNumber(latestSnapshot.qqqMovingAverage10m)}
                    </b>
                  </div>
                </div>
              </div>

              {latestSnapshot.market !== "RiskOn" ? (
                <div className="empty-state">現在はCash判定です。新規投資対象はありません。</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Ticker</th>
                        <th>Genre</th>
                        <th className="num">Current</th>
                        <th className="num">1M</th>
                        <th className="num">3M</th>
                        <th className="num">6M</th>
                        <th className="num">Score</th>
                        <th className="num">目標株数</th>
                        <th className="num">保有株数</th>
                        <th className="num">差分株数</th>
                        <th className="num">差分金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolioRows.map((row) => (
                        <tr key={row.symbol}>
                          <td>{row.rank}</td>
                          <td><b>{row.symbol}</b></td>
                          <td>{row.genre}</td>
                          <td className="num">{formatNumber(row.current)}</td>
                          <td className="num">{formatPercent(row.return1m)}</td>
                          <td className="num">{formatPercent(row.return3m)}</td>
                          <td className="num">{formatPercent(row.return6m)}</td>
                          <td className="num">{formatNumber(row.score, 3)}</td>
                          <td className="num">{row.targetShares}</td>
                          <td className="num">
                            <input
                              className="input momentum-share-input"
                              type="number"
                              value={row.actualShares}
                              onChange={(event) => updateActualShares(row.symbol, event.target.value)}
                            />
                          </td>
                          <td className={`num ${row.differenceShares >= 0 ? "positive" : "negative"}`}>
                            {row.differenceShares > 0 ? "+" : ""}{row.differenceShares}
                          </td>
                          <td className={`num ${row.differenceAmount >= 0 ? "positive" : "negative"}`}>
                            {usdFormatter.format(row.differenceAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {mode === "candidates" && (
            <div className="stack">
              <div className="panel candidate-add-panel">
                <div className="panel-body">
                  <div className="month-select-grid">
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
                  <button className="btn primary" type="button" onClick={() => addTicker(draftSymbol, draftGenre)}>
                    候補に追加
                  </button>
                  <div className="chip-row">
                    {MOMENTUM_CANDIDATE_SUGGESTIONS.map((ticker) => (
                      <button
                        key={ticker.symbol}
                        className="chip momentum-suggestion-chip"
                        type="button"
                        onClick={() => addTicker(ticker.symbol, ticker.genre)}
                      >
                        {ticker.symbol} / {ticker.genre}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ON</th>
                      <th>Ticker</th>
                      <th>Genre</th>
                      <th className="num">Rank</th>
                      <th className="num">Score</th>
                      <th>判定</th>
                      <th>理由</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickers.map((ticker) => {
                      const result = latestSnapshot.candidates.find((candidate) => candidate.symbol === ticker.symbol);
                      const isCustom = customTickers.some((item) => item.symbol === ticker.symbol);
                      return (
                        <tr key={ticker.symbol}>
                          <td>
                            <input
                              type="checkbox"
                              checked={enabledSymbols.has(ticker.symbol)}
                              onChange={() => toggleSymbol(ticker.symbol)}
                            />
                          </td>
                          <td><b>{ticker.symbol}</b></td>
                          <td>{ticker.genre}</td>
                          <td className="num">{result?.rank ?? "-"}</td>
                          <td className="num">{formatNumber(result?.score, 3)}</td>
                          <td>{result?.selected ? <span className="badge">採用</span> : result?.eligible ? "候補" : "除外"}</td>
                          <td>{result?.blockedReason ?? "-"}</td>
                          <td>
                            {isCustom && (
                              <button className="btn danger" type="button" onClick={() => removeCustomTicker(ticker.symbol)}>
                                削除
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {mode === "backtest" && (
            <div className="stack">
              <div className="month-select-grid">
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
                  <div className="readonly-box"><b>{backtest.startMonth}〜{backtest.endMonth}</b></div>
                </div>
              </div>

              <div className="kpis mini">
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

              <div className="kpis mini">
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

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Signal</th>
                      <th>Market</th>
                      <th>Pick</th>
                      <th className="num">月次</th>
                      <th className="num">Equity</th>
                      <th className="num">DD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backtest.rows.slice().reverse().map((row) => (
                      <tr key={row.date}>
                        <td>{row.date}</td>
                        <td>{row.market}</td>
                        <td>{row.picks.length > 0 ? row.picks.join(" / ") : "Cash"}</td>
                        <td className={`num ${row.monthlyReturn >= 0 ? "positive" : "negative"}`}>{formatPercent(row.monthlyReturn)}</td>
                        <td className="num">{numberFormatter.format(row.equity)}</td>
                        <td className="num negative">{formatPercent(row.drawdown)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
