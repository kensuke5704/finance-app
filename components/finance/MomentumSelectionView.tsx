"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchGooglePortfolio, type GooglePortfolioData, type GooglePortfolioRow } from "../../lib/googlePortfolio";

const ACTUAL_SHARES_STORAGE_KEY = "finance.momentum.actualShares.v1";
const TARGET_TOTAL_STORAGE_KEY = "finance.momentum.targetTotalUsd.v1";

export type MomentumPickForSync = { symbol: string; current: number };

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function number(value: number, digits = 2) {
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: digits }).format(value);
}

function percent(value: number) {
  return new Intl.NumberFormat("ja-JP", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function PortfolioCard({ row, targetTotal, actualShares, onSharesChange }: {
  row: GooglePortfolioRow;
  targetTotal: number;
  actualShares: number;
  onSharesChange: (value: number) => void;
}) {
  const targetShares = row.daily > 0 ? targetTotal / 10 / row.daily : 0;
  return (
    <article className="momentum-pick-card sheet-pick-card">
      <div className="momentum-pick-head">
        <div className="momentum-pick-title-block">
          <div className="momentum-rank-badge">Rank {number(row.rank, 0)}</div>
          <div className="momentum-title-row"><h3>{row.ticker}</h3></div>
        </div>
      </div>
      <div className="momentum-metric-grid portfolio-metric-grid">
        <div><span>基準値</span><b>{number(row.monthly)}</b></div>
        <div><span>現在値</span><b>{number(row.daily)}</b></div>
        <div><span>Score</span><b>{number(row.score, 3)}</b></div>
        <div><span>1M</span><b>{percent(row.return1m)}</b></div>
        <div><span>3M</span><b>{percent(row.return3m)}</b></div>
        <div><span>6M</span><b>{percent(row.return6m)}</b></div>
        <div className="share-ratio-box">
          <span>株数</span>
          <b>(<input className="momentum-share-inline-input" inputMode="decimal" value={actualShares || ""} onChange={(event) => onSharesChange(Number(event.target.value) || 0)} />)/{number(targetShares, 1)}</b>
        </div>
      </div>
    </article>
  );
}

export default function MomentumSelectionView({ onPicksChange }: { onPicksChange?: (picks: MomentumPickForSync[]) => void }) {
  const [data, setData] = useState<GooglePortfolioData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [targetTotal, setTargetTotal] = useState(6500);
  const [actualShares, setActualShares] = useState<Record<string, number>>({});
  const [showAllFields, setShowAllFields] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await fetchGooglePortfolio());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setActualShares(readJson(ACTUAL_SHARES_STORAGE_KEY, {}));
    setTargetTotal(readJson(TARGET_TOTAL_STORAGE_KEY, 6500));
    void load();
  }, []);

  useEffect(() => { window.localStorage.setItem(ACTUAL_SHARES_STORAGE_KEY, JSON.stringify(actualShares)); }, [actualShares]);
  useEffect(() => { window.localStorage.setItem(TARGET_TOTAL_STORAGE_KEY, JSON.stringify(targetTotal)); }, [targetTotal]);

  const picks = useMemo(() => data?.rows.map((row) => ({ symbol: row.ticker, current: row.daily })) ?? [], [data]);
  useEffect(() => { if (picks.length) onPicksChange?.(picks); }, [onPicksChange, picks]);

  return (
    <section className="stack momentum-selection-view">
      <div className="sheet-source-bar">
        <div>
          <b>Google スプレッドシート</b>
          <span>{data ? `${data.source === "cache" ? "前回取得分" : "最新データ"}・${new Date(data.updatedAt).toLocaleString("ja-JP")}` : "ポートフォリオを読み込みます"}</span>
        </div>
        <button className="btn" type="button" onClick={() => void load()} disabled={loading}>{loading ? "取得中" : "再取得"}</button>
      </div>
      {error && <div className="notice">取得できませんでした: {error}</div>}
      <section className="panel">
        <div className="panel-body stack momentum-main-body">
          <div className="month-select-grid momentum-target-grid">
            <label className="field">
              <span className="label">投資総額（USD）</span>
              <input className="input" inputMode="numeric" value={targetTotal} onChange={(event) => setTargetTotal(Number(event.target.value.replace(/[^0-9.-]/g, "")) || 0)} />
            </label>
            <div className="field"><span className="label">投資対象</span><div className="readonly-box compact-box"><b>{data?.rows.length ?? 0}銘柄</b></div></div>
          </div>
          <div className="momentum-card-list">
            {data?.rows.map((row) => <PortfolioCard key={row.ticker} row={row} targetTotal={targetTotal} actualShares={actualShares[row.ticker] ?? row.shares ?? 0} onSharesChange={(value) => setActualShares((current) => ({ ...current, [row.ticker]: value }))} />)}
          </div>
          {data && <div className="sheet-extra-fields">
            <button className="btn" type="button" onClick={() => setShowAllFields((current) => !current)}>{showAllFields ? "追加データを閉じる" : "スプレッドシートの全項目を表示"}</button>
            {showAllFields && data.rows.map((row) => <details key={row.ticker}><summary>{row.ticker}</summary><dl>{Object.entries(row.values).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "-"}</dd></div>)}</dl></details>)}
          </div>}
        </div>
      </section>
    </section>
  );
}
