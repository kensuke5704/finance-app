"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "finance.monthly-assets.v1";
const START_MONTH = "2026-07";
const COLORS = ["#353431", "#858078", "#b8b2a8", "#6f675c", "#747b75", "#9a827e"];

type Asset = { id: string; name: string; color: string };
type Ledger = {
  assets: Asset[];
  selectedMonth: string;
  lastInputMonth: string;
  values: Record<string, Record<string, number>>;
};

const initialLedger: Ledger = {
  assets: [
    { id: "cash", name: "現金", color: COLORS[0] },
    { id: "item-1", name: "商品1", color: COLORS[1] },
    { id: "item-2", name: "あ", color: COLORS[2] },
  ],
  selectedMonth: START_MONTH,
  lastInputMonth: START_MONTH,
  values: { [START_MONTH]: {} },
};

function monthLabel(month: string) {
  const [year, value] = month.split("-");
  return `${year}年${Number(value)}月`;
}

function monthShortLabel(month: string) {
  const [year, value] = month.split("-");
  return `${year.slice(2)}.${value}`;
}

function monthRange(start: string, end: string) {
  const result: string[] = [];
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  let cursor = startYear * 12 + startMonth - 1;
  const last = endYear * 12 + endMonth - 1;

  while (cursor <= last) {
    const year = Math.floor(cursor / 12);
    const month = (cursor % 12) + 1;
    result.push(`${year}-${String(month).padStart(2, "0")}`);
    cursor += 1;
  }
  return result;
}

function shiftMonth(month: string, amount: number) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(year, value - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatYen(value: number) {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function formatAxis(value: number) {
  if (value >= 100_000_000) return `${Number((value / 100_000_000).toFixed(1))}億`;
  if (value >= 10_000) return `${Number((value / 10_000).toFixed(1))}万`;
  return formatYen(Math.round(value));
}

function niceMaximum(value: number) {
  if (value <= 0) return 100_000;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function AssetChart({ ledger, months }: { ledger: Ledger; months: string[] }) {
  const width = 760;
  const height = 286;
  const plot = { left: 70, right: 18, top: 24, bottom: 48 };
  const chartWidth = width - plot.left - plot.right;
  const chartHeight = height - plot.top - plot.bottom;
  const allValues = months.flatMap((month) =>
    ledger.assets.map((asset) => ledger.values[month]?.[asset.id] || 0),
  );
  const maximum = niceMaximum(Math.max(...allValues, 0));
  const labelStep = Math.max(1, Math.ceil(months.length / 8));
  const xFor = (index: number) =>
    months.length === 1
      ? plot.left + chartWidth / 2
      : plot.left + (index / (months.length - 1)) * chartWidth;
  const yFor = (value: number) => plot.top + chartHeight - (value / maximum) * chartHeight;
  const baseline = plot.top + chartHeight;

  const series = ledger.assets.map((asset) => {
    const points = months.map((month, index) => ({
      month,
      value: ledger.values[month]?.[asset.id] || 0,
      x: xFor(index),
      y: yFor(ledger.values[month]?.[asset.id] || 0),
    }));
    const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");
    const area = `${line} L${points.at(-1)?.x ?? plot.left} ${baseline} L${points[0]?.x ?? plot.left} ${baseline} Z`;
    return { asset, points, line, area };
  });

  return (
    <div className="chart-wrap">
      <svg
        className="asset-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${monthLabel(START_MONTH)}から${monthLabel(ledger.lastInputMonth)}までの資産推移`}
      >
        <title>資産の推移</title>
        {[0, 0.5, 1].map((ratio) => {
          const y = plot.top + chartHeight * (1 - ratio);
          return (
            <g key={ratio}>
              <line x1={plot.left} x2={width - plot.right} y1={y} y2={y} className="grid-line" />
              <text x={plot.left - 12} y={y + 4} textAnchor="end" className="axis-text">
                {formatAxis(maximum * ratio)}
              </text>
            </g>
          );
        })}

        {series.map(({ asset, area }) => (
          <path key={`${asset.id}-area`} d={area} fill={asset.color} className="series-area" />
        ))}

        {series.map(({ asset, points, line }) => (
          <g key={asset.id}>
            <path d={line} stroke={asset.color} className="series-line" />
            {points.map((point) => (
              <circle key={point.month} cx={point.x} cy={point.y} r="4" fill={asset.color}>
                <title>{`${monthLabel(point.month)} ${asset.name || "名称未設定"} ${formatYen(point.value)}円`}</title>
              </circle>
            ))}
          </g>
        ))}

        {months.map((month, index) =>
          index % labelStep === 0 || index === months.length - 1 ? (
            <text key={month} x={xFor(index)} y={height - 15} textAnchor="middle" className="axis-text">
              {monthShortLabel(month)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

export default function Home() {
  const [ledger, setLedger] = useState<Ledger>(initialLedger);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(true);
  const newestNameRef = useRef<HTMLInputElement>(null);
  const [focusNewest, setFocusNewest] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Ledger;
        if (parsed.assets?.length && parsed.values && parsed.lastInputMonth) setLedger(parsed);
      }
    } catch {
      // If this new-format record is damaged, start with a fresh July 2026 ledger.
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    setSaved(false);
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
      setSaved(true);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [ledger, ready]);

  useEffect(() => {
    if (!focusNewest) return;
    newestNameRef.current?.focus();
    newestNameRef.current?.select();
    setFocusNewest(false);
  }, [focusNewest, ledger.assets.length]);

  const months = useMemo(
    () => monthRange(START_MONTH, ledger.lastInputMonth),
    [ledger.lastInputMonth],
  );
  const selectedValues = ledger.values[ledger.selectedMonth] || {};

  const selectMonth = (month: string) => {
    if (!month || month < START_MONTH) return;
    setLedger((current) => ({
      ...current,
      selectedMonth: month,
      values: current.values[month] ? current.values : { ...current.values, [month]: {} },
    }));
  };

  const setAmount = (assetId: string, rawValue: string) => {
    const value = Math.max(0, Number(rawValue.replace(/[^0-9]/g, "")) || 0);
    setLedger((current) => ({
      ...current,
      lastInputMonth:
        current.selectedMonth > current.lastInputMonth ? current.selectedMonth : current.lastInputMonth,
      values: {
        ...current.values,
        [current.selectedMonth]: {
          ...(current.values[current.selectedMonth] || {}),
          [assetId]: value,
        },
      },
    }));
  };

  const renameAsset = (assetId: string, name: string) => {
    setLedger((current) => ({
      ...current,
      assets: current.assets.map((asset) => (asset.id === assetId ? { ...asset, name } : asset)),
    }));
  };

  const addAsset = () => {
    setLedger((current) => {
      const index = current.assets.length;
      return {
        ...current,
        assets: [
          ...current.assets,
          {
            id: `asset-${Date.now()}`,
            name: `商品${index}`,
            color: COLORS[index % COLORS.length],
          },
        ],
      };
    });
    setFocusNewest(true);
  };

  const removeAsset = (assetId: string) => {
    if (ledger.assets.length === 1) return;
    setLedger((current) => ({
      ...current,
      assets: current.assets.filter((asset) => asset.id !== assetId),
    }));
  };

  return (
    <main className="page-shell">
      <section className="ledger" aria-labelledby="page-title">
        <header className="page-header">
          <h1 id="page-title">Finance</h1>
          <div className="month-picker" aria-label="入力する月を選択">
            <button
              type="button"
              onClick={() => selectMonth(shiftMonth(ledger.selectedMonth, -1))}
              disabled={ledger.selectedMonth === START_MONTH}
              aria-label="前の月"
            >←</button>
            <input
              type="month"
              min={START_MONTH}
              value={ledger.selectedMonth}
              onChange={(event) => selectMonth(event.target.value)}
              aria-label="入力月"
            />
            <button
              type="button"
              onClick={() => selectMonth(shiftMonth(ledger.selectedMonth, 1))}
              aria-label="次の月"
            >→</button>
          </div>
        </header>

        <section className="chart-panel" aria-labelledby="chart-title">
          <div className="section-heading">
            <h2 id="chart-title">資産の推移</h2>
            <p>{monthLabel(START_MONTH)} — {monthLabel(ledger.lastInputMonth)}</p>
          </div>
          <ul className="legend" aria-label="資産項目の凡例">
            {ledger.assets.map((asset) => (
              <li key={asset.id}><span style={{ background: asset.color }} />{asset.name || "名称未設定"}</li>
            ))}
          </ul>
          <AssetChart ledger={ledger} months={months} />
        </section>

        <section className="entry-panel" aria-labelledby="entry-title">
          <div className="entry-heading">
            <h2 id="entry-title">{monthLabel(ledger.selectedMonth)}の資産</h2>
            <p>項目名は直接編集できます</p>
          </div>

          <div className="asset-grid">
            {ledger.assets.map((asset, index) => (
              <article className="asset-field" key={asset.id}>
                <div className="asset-name-row">
                  <span className="color-dot" style={{ background: asset.color }} aria-hidden="true" />
                  <input
                    ref={index === ledger.assets.length - 1 ? newestNameRef : undefined}
                    className="asset-name"
                    value={asset.name}
                    onChange={(event) => renameAsset(asset.id, event.target.value)}
                    aria-label={`資産項目${index + 1}の名称`}
                  />
                  <button
                    type="button"
                    className="remove-button"
                    onClick={() => removeAsset(asset.id)}
                    disabled={ledger.assets.length === 1}
                    aria-label={`${asset.name || `資産項目${index + 1}`}を削除`}
                    title="項目を削除"
                  >×</button>
                </div>
                <label>
                  <span className="sr-only">{asset.name || `資産項目${index + 1}`}の金額</span>
                  <input
                    className="amount-input"
                    type="text"
                    inputMode="numeric"
                    value={selectedValues[asset.id] ? formatYen(selectedValues[asset.id]) : ""}
                    placeholder="0"
                    onChange={(event) => setAmount(asset.id, event.target.value)}
                  />
                  <span className="yen">円</span>
                </label>
              </article>
            ))}
          </div>

          <div className="add-row">
            <button type="button" className="add-asset" onClick={addAsset} aria-label="資産項目を追加">
              ＋
            </button>
          </div>
        </section>

        <footer>
          <span>入力開始：2026年7月</span>
          <span className={saved ? "is-saved" : ""} aria-live="polite">
            {saved ? "保存済み" : "保存中"}
          </span>
        </footer>
      </section>
    </main>
  );
}
