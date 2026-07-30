"use client";

import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "finance.monthly-assets.v1";
const EARLIEST_MONTH = "2025-01";
const DEFAULT_MONTH = "2026-07";
const COLORS = [
  "#3f4943",
  "#a56f55",
  "#7d8e78",
  "#8b7185",
  "#b29a58",
  "#637c8a",
  "#a06f70",
  "#6e675a",
];

type Asset = { id: string; name: string; color: string };
type AssetPlan = { monthlyBudget: number; annualRate: number };
type StoredAssetPlan = Partial<AssetPlan> & { monthlyRate?: number };
type WorkspaceTab = "assets" | "settings" | "data";
type Ledger = {
  assets: Asset[];
  selectedMonth: string;
  inputMonths: string[];
  values: Record<string, Record<string, number>>;
  plans: Record<string, AssetPlan>;
};
type Backup = {
  app: "Finance";
  version: 1;
  exportedAt: string;
  ledger: Ledger;
};

const initialLedger: Ledger = {
  assets: [
    { id: "cash", name: "現金", color: COLORS[0] },
    { id: "item-1", name: "商品1", color: COLORS[1] },
    { id: "item-2", name: "あ", color: COLORS[2] },
  ],
  selectedMonth: DEFAULT_MONTH,
  inputMonths: [],
  values: { [DEFAULT_MONTH]: {} },
  plans: {},
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

function annualRateFromMonthlyRate(monthlyRate: number) {
  const normalizedMonthlyRate = Math.max(-100, monthlyRate) / 100;
  const annualRate = ((1 + normalizedMonthlyRate) ** 12 - 1) * 100;
  return Math.round(annualRate * 1_000_000) / 1_000_000;
}

function monthlyRateFromAnnualRate(annualRate: number) {
  return (1 + Math.max(-100, annualRate) / 100) ** (1 / 12) - 1;
}

function restoreLedger(input: unknown): Ledger | null {
  if (!input || typeof input !== "object") return null;

  const candidate = input as Partial<Ledger>;
  if (!Array.isArray(candidate.assets) || candidate.assets.length === 0) return null;
  if (!candidate.values || typeof candidate.values !== "object") return null;

  const assets = candidate.assets.map((asset, index) => {
    if (!asset || typeof asset !== "object") return null;
    const item = asset as Partial<Asset>;
    if (typeof item.id !== "string" || typeof item.name !== "string") return null;
    return { id: item.id, name: item.name, color: COLORS[index % COLORS.length] };
  });
  if (assets.some((asset) => asset === null)) return null;

  const assetIds = new Set(assets.map((asset) => asset?.id));
  const values: Ledger["values"] = {};
  for (const [month, record] of Object.entries(candidate.values)) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month < EARLIEST_MONTH) continue;
    if (!record || typeof record !== "object") return null;
    values[month] = {};
    for (const [assetId, amount] of Object.entries(record)) {
      if (!assetIds.has(assetId)) continue;
      if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) return null;
      values[month][assetId] = amount;
    }
  }

  const inputMonths = Object.entries(values)
    .filter(([, record]) => Object.keys(record).length > 0)
    .map(([month]) => month)
    .sort();
  const selectedMonth =
    typeof candidate.selectedMonth === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(candidate.selectedMonth) &&
    candidate.selectedMonth >= EARLIEST_MONTH
      ? candidate.selectedMonth
      : inputMonths.at(-1) || DEFAULT_MONTH;

  if (!values[selectedMonth]) values[selectedMonth] = {};

  const rawPlans =
    candidate.plans && typeof candidate.plans === "object"
      ? candidate.plans
      : {};
  const plans = Object.fromEntries(
    (assets as Asset[]).map((asset) => {
      const rawPlan = rawPlans[asset.id] as StoredAssetPlan | undefined;
      const monthlyBudget =
        rawPlan && Number.isFinite(rawPlan.monthlyBudget)
          ? Math.max(0, rawPlan.monthlyBudget as number)
          : 0;
      const annualRate =
        rawPlan && Number.isFinite(rawPlan.annualRate)
          ? Math.max(-100, rawPlan.annualRate as number)
          : rawPlan && Number.isFinite(rawPlan.monthlyRate)
            ? annualRateFromMonthlyRate(rawPlan.monthlyRate as number)
            : 0;
      return [asset.id, { monthlyBudget, annualRate }];
    }),
  );

  return {
    assets: assets as Asset[],
    selectedMonth,
    inputMonths,
    values,
    plans,
  };
}

function AssetChart({
  ledger,
  months,
  forecastMonths,
  selectedAssetId,
  onSelectAsset,
}: {
  ledger: Ledger;
  months: string[];
  forecastMonths: string[];
  selectedAssetId: string | null;
  onSelectAsset: (assetId: string) => void;
}) {
  const width = 760;
  const height = 286;
  const plot = { left: 70, right: 18, top: 24, bottom: 48 };
  const chartWidth = width - plot.left - plot.right;
  const chartHeight = height - plot.top - plot.bottom;
  const displayedAssets = selectedAssetId
    ? ledger.assets.filter((asset) => asset.id === selectedAssetId)
    : ledger.assets;
  const displayMonths = [...months, ...forecastMonths];
  const actualTotals = months.map((month) =>
    displayedAssets.reduce(
      (total, asset) => total + (ledger.values[month]?.[asset.id] || 0),
      0,
    ),
  );
  const latestMonth = months.at(-1) || ledger.selectedMonth;
  const forecastValues = displayedAssets.map((asset) => {
    const plan = ledger.plans[asset.id] || { monthlyBudget: 0, annualRate: 0 };
    const monthlyRate = monthlyRateFromAnnualRate(plan.annualRate);
    let current = ledger.values[latestMonth]?.[asset.id] || 0;
    return forecastMonths.map(() => {
      current = (current + plan.monthlyBudget) * (1 + monthlyRate);
      return current;
    });
  });
  const forecastTotals = forecastMonths.map((_, monthIndex) =>
    forecastValues.reduce((total, values) => total + values[monthIndex], 0),
  );
  const maximum = niceMaximum(Math.max(...actualTotals, ...forecastTotals, 0));
  const labelStep = Math.max(1, Math.ceil(displayMonths.length / 8));
  const xFor = (index: number) =>
    displayMonths.length === 1
      ? plot.left + chartWidth / 2
      : plot.left + (index / (displayMonths.length - 1)) * chartWidth;
  const yFor = (value: number) => plot.top + chartHeight - (value / maximum) * chartHeight;
  const actualCumulative = months.map(() => 0);
  const actualSeries = displayedAssets.map((asset) => {
    const points = months.map((month, index) => {
      const value = ledger.values[month]?.[asset.id] || 0;
      const lowerValue = actualCumulative[index];
      const upperValue = lowerValue + value;
      actualCumulative[index] = upperValue;
      return {
        month,
        value,
        x: xFor(index),
        y: yFor(upperValue),
        lowerY: yFor(lowerValue),
      };
    });
    const line = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
      .join(" ");
    const lowerBoundary = [...points]
      .reverse()
      .map((point) => `L${point.x} ${point.lowerY}`)
      .join(" ");
    const area = `${line} ${lowerBoundary} Z`;
    return { asset, points, line, area };
  });
  const forecastCumulative = Array.from({ length: forecastMonths.length + 1 }, () => 0);
  const forecastSeries = displayedAssets.map((asset, assetIndex) => {
    const values = [
      ledger.values[latestMonth]?.[asset.id] || 0,
      ...forecastValues[assetIndex],
    ];
    const seriesMonths = [latestMonth, ...forecastMonths];
    const points = seriesMonths.map((month, index) => {
      const value = values[index];
      const lowerValue = forecastCumulative[index];
      const upperValue = lowerValue + value;
      forecastCumulative[index] = upperValue;
      return {
        month,
        value,
        x: xFor(months.length - 1 + index),
        y: yFor(upperValue),
        lowerY: yFor(lowerValue),
      };
    });
    const line = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
      .join(" ");
    const lowerBoundary = [...points]
      .reverse()
      .map((point) => `L${point.x} ${point.lowerY}`)
      .join(" ");
    const area = `${line} ${lowerBoundary} Z`;
    return { asset, points, line, area };
  });
  const selectLabel = (asset: Asset) =>
    selectedAssetId === asset.id
      ? "全項目を表示"
      : `${asset.name || "名称未設定"}だけを表示`;
  const handleKeySelect = (
    event: KeyboardEvent<SVGPathElement>,
    assetId: string,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectAsset(assetId);
    }
  };

  return (
    <div className="chart-wrap">
      <svg
        className="asset-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${monthLabel(months[0])}から${monthLabel(forecastMonths.at(-1) || latestMonth)}までの積み上げ資産推移と予測`}
      >
        <title>積み上げ資産の実績と予測</title>
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

        {actualSeries.map(({ asset, area }) => (
          <path
            key={`${asset.id}-area`}
            d={area}
            fill={asset.color}
            className="series-area"
            onPointerDown={() => onSelectAsset(asset.id)}
            role="button"
            tabIndex={0}
            aria-label={selectLabel(asset)}
            onKeyDown={(event) => handleKeySelect(event, asset.id)}
          />
        ))}

        {actualSeries.map(({ asset, points, line }) => (
          <g key={asset.id}>
            <path d={line} stroke={asset.color} className="series-line" />
            {points.map((point) => (
              <circle key={point.month} cx={point.x} cy={point.y} r="4" fill={asset.color}>
                <title>{`${monthLabel(point.month)} ${asset.name || "名称未設定"} ${formatYen(point.value)}円`}</title>
              </circle>
            ))}
          </g>
        ))}

        {forecastSeries.map(({ asset, area }) => (
          <path
            key={`${asset.id}-forecast-area`}
            d={area}
            fill={asset.color}
            className="forecast-area"
            onPointerDown={() => onSelectAsset(asset.id)}
            role="button"
            tabIndex={0}
            aria-label={selectLabel(asset)}
            onKeyDown={(event) => handleKeySelect(event, asset.id)}
          />
        ))}

        {forecastSeries.map(({ asset, points, line }) => (
          <g key={`${asset.id}-forecast`}>
            <path d={line} stroke={asset.color} className="forecast-line" />
            {points.slice(1).map((point) => (
              <circle
                key={point.month}
                cx={point.x}
                cy={point.y}
                r="3"
                fill={asset.color}
                className="forecast-point"
              >
                <title>{`${monthLabel(point.month)} ${asset.name || "名称未設定"} 予測 ${formatYen(Math.round(point.value))}円`}</title>
              </circle>
            ))}
          </g>
        ))}

        {displayMonths.map((month, index) =>
          index % labelStep === 0 || index === displayMonths.length - 1 ? (
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
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("assets");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(true);
  const [backupStatus, setBackupStatus] = useState("");
  const newestNameRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [focusNewest, setFocusNewest] = useState(false);

  const changeTab = (
    tab: WorkspaceTab,
    event?: KeyboardEvent<HTMLButtonElement>,
  ) => {
    setActiveTab(tab);
    if (event) {
      const button = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(
        `[data-tab="${tab}"]`,
      );
      button?.focus();
    }
  };

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    tab: WorkspaceTab,
  ) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const tabs: WorkspaceTab[] = ["assets", "settings", "data"];
    const currentIndex = tabs.indexOf(tab);
    const direction = event.key === "ArrowRight" ? 1 : -1;
    changeTab(tabs[(currentIndex + direction + tabs.length) % tabs.length], event);
  };

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const restored = restoreLedger(JSON.parse(stored));
        if (restored) setLedger(restored);
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

  const months = useMemo(() => {
    const sortedInputMonths = [...ledger.inputMonths].sort();
    const firstMonth = sortedInputMonths[0] || ledger.selectedMonth;
    const lastMonth = sortedInputMonths.at(-1) || ledger.selectedMonth;
    return monthRange(firstMonth, lastMonth);
  }, [ledger.inputMonths, ledger.selectedMonth]);
  const forecastMonths = useMemo(() => {
    const latestMonth = ledger.inputMonths.at(-1) || ledger.selectedMonth;
    return Array.from({ length: 12 }, (_, index) => shiftMonth(latestMonth, index + 1));
  }, [ledger.inputMonths, ledger.selectedMonth]);
  const selectedValues = ledger.values[ledger.selectedMonth] || {};

  const selectMonth = (month: string) => {
    if (!month || month < EARLIEST_MONTH) return;
    setLedger((current) => ({
      ...current,
      selectedMonth: month,
      values: current.values[month] ? current.values : { ...current.values, [month]: {} },
    }));
  };

  const setAmount = (assetId: string, rawValue: string) => {
    const digits = rawValue.replace(/[^0-9]/g, "");
    setLedger((current) => {
      const monthValues = { ...(current.values[current.selectedMonth] || {}) };

      if (digits === "") {
        delete monthValues[assetId];
      } else {
        monthValues[assetId] = Math.max(0, Number(digits) || 0);
      }

      const hasAnyValue = Object.keys(monthValues).length > 0;
      return {
        ...current,
        inputMonths: hasAnyValue
          ? current.inputMonths.includes(current.selectedMonth)
            ? current.inputMonths
            : [...current.inputMonths, current.selectedMonth].sort()
          : current.inputMonths.filter((month) => month !== current.selectedMonth),
        values: {
          ...current.values,
          [current.selectedMonth]: monthValues,
        },
      };
    });
  };

  const renameAsset = (assetId: string, name: string) => {
    setLedger((current) => ({
      ...current,
      assets: current.assets.map((asset) => (asset.id === assetId ? { ...asset, name } : asset)),
    }));
  };

  const setPlan = (
    assetId: string,
    field: keyof AssetPlan,
    rawValue: string,
  ) => {
    const parsed = rawValue === "" ? 0 : Number(rawValue);
    const value = Number.isFinite(parsed)
      ? field === "monthlyBudget"
        ? Math.max(0, parsed)
        : Math.max(-100, parsed)
      : 0;
    setLedger((current) => ({
      ...current,
      plans: {
        ...current.plans,
        [assetId]: {
          ...(current.plans[assetId] || { monthlyBudget: 0, annualRate: 0 }),
          [field]: value,
        },
      },
    }));
  };

  const addAsset = () => {
    setLedger((current) => {
      const index = current.assets.length;
      const id = `asset-${Date.now()}`;
      return {
        ...current,
        assets: [
          ...current.assets,
          {
            id,
            name: `商品${index}`,
            color: COLORS[index % COLORS.length],
          },
        ],
        plans: {
          ...current.plans,
          [id]: { monthlyBudget: 0, annualRate: 0 },
        },
      };
    });
    setFocusNewest(true);
  };

  const removeAsset = (assetId: string) => {
    if (ledger.assets.length === 1) return;
    if (selectedAssetId === assetId) setSelectedAssetId(null);
    setLedger((current) => {
      const plans = { ...current.plans };
      delete plans[assetId];
      return {
        ...current,
        assets: current.assets.filter((asset) => asset.id !== assetId),
        plans,
      };
    });
  };

  const saveBackup = () => {
    const backup: Backup = {
      app: "Finance",
      version: 1,
      exportedAt: new Date().toISOString(),
      ledger,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toLocaleDateString("sv-SE");
    link.href = url;
    link.download = `finance-backup-${date}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBackupStatus("バックアップを保存しました");
  };

  const loadBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const restored = restoreLedger(
        parsed && typeof parsed === "object" && "ledger" in parsed
          ? (parsed as Partial<Backup>).ledger
          : parsed,
      );
      if (!restored) throw new Error("invalid backup");
      if (!window.confirm("現在のデータをバックアップ内容で置き換えます。よろしいですか？")) {
        setBackupStatus("読み込みをキャンセルしました");
        return;
      }
      setSelectedAssetId(null);
      setLedger(restored);
      setBackupStatus("バックアップを読み込みました");
    } catch {
      setBackupStatus("このファイルは読み込めません");
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark" aria-label="Finance">
          <span aria-hidden="true">¥</span>
        </div>
        <nav className="workspace-tabs" role="tablist" aria-label="画面切り替え">
          <button
            type="button"
            role="tab"
            data-tab="assets"
            aria-selected={activeTab === "assets"}
            tabIndex={activeTab === "assets" ? 0 : -1}
            className={activeTab === "assets" ? "is-active" : ""}
            onClick={() => changeTab("assets")}
            onKeyDown={(event) => handleTabKeyDown(event, "assets")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 18V6m0 12h16M7 14l4-4 3 2 5-6" />
            </svg>
            資産
          </button>
          <button
            type="button"
            role="tab"
            data-tab="settings"
            aria-selected={activeTab === "settings"}
            tabIndex={activeTab === "settings" ? 0 : -1}
            className={activeTab === "settings" ? "is-active" : ""}
            onClick={() => changeTab("settings")}
            onKeyDown={(event) => handleTabKeyDown(event, "settings")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.4-6.4-2.1 2.1M7.7 16.3l-2.1 2.1m12.8 0-2.1-2.1M7.7 7.7 5.6 5.6" />
            </svg>
            設定
          </button>
          <button
            type="button"
            role="tab"
            data-tab="data"
            aria-selected={activeTab === "data"}
            tabIndex={activeTab === "data" ? 0 : -1}
            className={activeTab === "data" ? "is-active" : ""}
            onClick={() => changeTab("data")}
            onKeyDown={(event) => handleTabKeyDown(event, "data")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 5h14v14H5zM8 5v5h8V5M8 19v-5h8v5" />
            </svg>
            データ管理
          </button>
        </nav>
        <div className="sidebar-status">
          <span className={saved ? "status-dot is-saved" : "status-dot"} aria-hidden="true" />
          <span aria-live="polite">{saved ? "保存済み" : "保存中"}</span>
        </div>
      </aside>

      <main className="page-shell">
        <header className="topbar">
          <div>
            <span className="eyebrow">MONTHLY ASSET LEDGER</span>
            <strong>
              {activeTab === "assets"
                ? "資産"
                : activeTab === "settings"
                  ? "設定"
                  : "データ管理"}
            </strong>
          </div>
          <span className="save-badge">
            <span className={saved ? "status-dot is-saved" : "status-dot"} aria-hidden="true" />
            {saved ? "保存済み" : "保存中"}
          </span>
        </header>

        <section className="ledger" aria-label="Finance">
          {activeTab === "assets" ? (
          <>
            <header className="page-header">
              <div>
                <h1>資産の記録</h1>
                <p>月ごとの資産額と、設定した条件による将来予測</p>
              </div>
              <div className="month-picker" aria-label="入力する月を選択">
                <button
                  type="button"
                  onClick={() => selectMonth(shiftMonth(ledger.selectedMonth, -1))}
                  disabled={ledger.selectedMonth === EARLIEST_MONTH}
                  aria-label="前の月"
                >←</button>
                <input
                  type="month"
                  min={EARLIEST_MONTH}
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

            <div className="assets-layout">
              <section className="chart-panel" aria-labelledby="chart-title">
              <div className="section-heading">
                <div>
                  <h2 id="chart-title">資産の推移</h2>
                  <p>
                    実績 {monthLabel(months[0])} — {monthLabel(months.at(-1) || months[0])}
                    <span aria-hidden="true"> / </span>
                    予測 {monthLabel(forecastMonths.at(-1) || months[0])}まで
                  </p>
                </div>
              </div>
              <ul className="legend" aria-label="資産項目の凡例">
                {ledger.assets.map((asset) => (
                  <li key={asset.id}>
                    <button
                      type="button"
                      className={selectedAssetId === asset.id ? "is-selected" : ""}
                      aria-pressed={selectedAssetId === asset.id}
                      onClick={() =>
                        setSelectedAssetId((current) => (current === asset.id ? null : asset.id))
                      }
                    >
                      <span style={{ background: asset.color }} />
                      {asset.name || "名称未設定"}
                    </button>
                  </li>
                ))}
                <li className="forecast-key"><span />予測</li>
              </ul>
              <AssetChart
                ledger={ledger}
                months={months}
                forecastMonths={forecastMonths}
                selectedAssetId={selectedAssetId}
                onSelectAsset={(assetId) =>
                  setSelectedAssetId((current) => (current === assetId ? null : assetId))
                }
              />
              </section>

              <section className="entry-panel" aria-labelledby="entry-title">
              <div className="entry-heading">
                <div>
                  <h2 id="entry-title">{monthLabel(ledger.selectedMonth)}の資産</h2>
                  <p>項目名は直接編集できます</p>
                </div>
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
                        value={
                          asset.id in selectedValues ? formatYen(selectedValues[asset.id]) : ""
                        }
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
            </div>
          </>
          ) : activeTab === "settings" ? (
            <>
              <header className="page-header">
                <div>
                  <h1>予測設定</h1>
                  <p>資産項目ごとの積立予算と想定年利</p>
                </div>
              </header>
              <section className="settings-panel" aria-labelledby="settings-title">
                <div className="settings-heading">
                  <div>
                    <h2 id="settings-title">予算と年利</h2>
                    <p>最新の入力額を基準に、12か月先までの資産を予測します。</p>
                  </div>
                  <p className="forecast-formula">
                    月利 ＝（1 ＋ 年利）<sup>1/12</sup> − 1
                  </p>
                </div>
                <div className="plan-list">
                  {ledger.assets.map((asset) => {
                    const plan = ledger.plans[asset.id] || {
                      monthlyBudget: 0,
                      annualRate: 0,
                    };
                    return (
                      <article className="plan-row" key={asset.id}>
                        <div className="plan-asset">
                          <span
                            className="color-dot"
                            style={{ background: asset.color }}
                            aria-hidden="true"
                          />
                          <strong>{asset.name || "名称未設定"}</strong>
                        </div>
                        <label>
                          <span>毎月の予算</span>
                          <span className="plan-input-wrap">
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              inputMode="numeric"
                              value={plan.monthlyBudget || ""}
                              placeholder="0"
                              onChange={(event) =>
                                setPlan(asset.id, "monthlyBudget", event.target.value)
                              }
                              aria-label={`${asset.name || "名称未設定"}の毎月の予算`}
                            />
                            <span>円</span>
                          </span>
                        </label>
                        <label>
                          <span>年利</span>
                          <span className="plan-input-wrap rate">
                            <input
                              type="number"
                              min="-100"
                              step="0.1"
                              inputMode="decimal"
                              value={plan.annualRate || ""}
                              placeholder="0"
                              onChange={(event) =>
                                setPlan(asset.id, "annualRate", event.target.value)
                              }
                              aria-label={`${asset.name || "名称未設定"}の年利`}
                            />
                            <span>%</span>
                          </span>
                        </label>
                      </article>
                    );
                  })}
                </div>
              </section>
            </>
          ) : (
            <>
              <header className="page-header">
                <div>
                  <h1>データ管理</h1>
                  <p>端末間の移行とバックアップ</p>
                </div>
              </header>
              <section className="backup-panel" aria-labelledby="backup-title">
                <div className="backup-copy">
                  <div className="backup-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M5 5h14v14H5zM8 5v5h8V5M8 19v-5h8v5" />
                    </svg>
                  </div>
                  <div>
                    <h2 id="backup-title">データの引き継ぎ</h2>
                    <p>旧端末で保存し、新しい端末で同じファイルを読み込んでください。</p>
                  </div>
                </div>
                <div className="backup-controls">
                  <button type="button" onClick={saveBackup}>バックアップを保存</button>
                  <button type="button" onClick={() => backupInputRef.current?.click()}>
                    バックアップを読み込む
                  </button>
                  <input
                    ref={backupInputRef}
                    className="sr-only"
                    type="file"
                    accept="application/json,.json"
                    onChange={loadBackup}
                    aria-label="バックアップファイルを選択"
                  />
                </div>
                {backupStatus && (
                  <p className="backup-status" role="status">{backupStatus}</p>
                )}
              </section>
            </>
          )}

          <footer>
            <span>入力可能：2025年1月以降</span>
          </footer>
        </section>
      </main>
    </div>
  );
}
