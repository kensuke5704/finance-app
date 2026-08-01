"use client";

import { ChangeEvent, KeyboardEvent, SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";

const STORAGE_KEY = "finance.monthly-assets.v1";
const AMOUNT_VISIBILITY_KEY = "finance.amounts-visible.v1";
const EARLIEST_MONTH = "2025-01";
const DEFAULT_MONTH = currentMonthKey();
const CLOUD_DOCUMENT = doc(db, "shared", "finance");
const SHARED_EMAILS = ["kensuke5704@gmail.com", "momoha5704@gmail.com"];
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
type BudgetCategory = "budget" | "other";
type BudgetGroup = { id: string; name: string; category: BudgetCategory };
type BudgetPeriod = {
  id: string;
  category: BudgetCategory;
  groupId?: string;
  mode: "single" | "range";
  memo: string;
  startMonth: string;
  endMonth: string;
  income: number;
  expense: number;
  investments: Record<string, number>;
};
type WorkspaceTab = "assets" | "plans" | "settings" | "data";
type ChartRange = "S" | "L" | "LL";
type PlanSortOrder = "asc" | "desc";
type AccountId = "primary" | "secondary";
type SyncStatus = "local" | "connecting" | "synced" | "saving" | "error";

const CHART_RANGE_MONTHS: Record<ChartRange, number> = {
  S: 12,
  L: 60,
  LL: 180,
};
type Ledger = {
  assets: Asset[];
  selectedMonth: string;
  inputMonths: string[];
  values: Record<string, Record<string, number>>;
  plans: Record<string, AssetPlan>;
  budgetGroups: BudgetGroup[];
  budgetPeriods: BudgetPeriod[];
};
type AccountStore = {
  activeAccount: AccountId;
  accounts: Record<AccountId, Ledger>;
};
type Backup = {
  app: "Finance";
  version: 2;
  exportedAt: string;
  accounts: AccountStore;
};

const ACCOUNT_LABELS: Record<AccountId, string> = {
  primary: "K",
  secondary: "M",
};

function currentMonthKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function createInitialLedger(): Ledger {
  return {
  assets: [
    { id: "cash", name: "現金", color: COLORS[0] },
    { id: "item-1", name: "商品1", color: COLORS[1] },
    { id: "item-2", name: "あ", color: COLORS[2] },
  ],
  selectedMonth: DEFAULT_MONTH,
  inputMonths: [],
    values: { [DEFAULT_MONTH]: {} },
    plans: {},
    budgetGroups: [],
    budgetPeriods: [],
  };
}

const initialLedger = createInitialLedger();

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

function displayedYen(value: number, visible: boolean) {
  return visible ? formatYen(value) : "••••";
}

function CurrencyInput({
  value,
  hasValue = value !== 0,
  showAmounts,
  readOnly = false,
  allowNegative = false,
  className,
  ariaLabel,
  onValueChange,
}: {
  value: number;
  hasValue?: boolean;
  showAmounts: boolean;
  readOnly?: boolean;
  allowNegative?: boolean;
  className?: string;
  ariaLabel: string;
  onValueChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const rawValue = hasValue ? String(value) : "";

  useEffect(() => {
    if (!editing) setDraft(rawValue);
  }, [editing, rawValue]);

  const sanitize = (input: string) => {
    const cleaned = input.replace(allowNegative ? /[^0-9-]/g : /[^0-9]/g, "");
    if (!allowNegative) return cleaned;
    const negative = cleaned.startsWith("-") ? "-" : "";
    return `${negative}${cleaned.replace(/-/g, "")}`;
  };

  return (
    <input
      ref={inputRef}
      className={className}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      value={editing ? draft : (hasValue ? displayedYen(value, showAmounts) : "")}
      placeholder="0"
      readOnly={readOnly}
      aria-label={ariaLabel}
      onFocus={(event) => {
        if (readOnly) return;
        const caret = event.currentTarget.selectionStart ?? event.currentTarget.value.length;
        const rawCaret = event.currentTarget.value.slice(0, caret).replace(/[^0-9-]/g, "").length;
        setDraft(rawValue);
        setEditing(true);
        window.requestAnimationFrame(() => inputRef.current?.setSelectionRange(rawCaret, rawCaret));
      }}
      onChange={(event) => {
        const next = sanitize(event.target.value);
        setDraft(next);
        onValueChange(next);
      }}
      onBlur={() => setEditing(false)}
    />
  );
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

function validMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value >= EARLIEST_MONTH;
}

function activeBudgetPeriods(ledger: Ledger, month: string) {
  return ledger.budgetPeriods.filter(
    (period) => period.startMonth <= month && month <= period.endMonth,
  );
}

function budgetForMonth(ledger: Ledger, month: string, assetId: string) {
  const periods = activeBudgetPeriods(ledger, month);
  if (periods.length > 0) {
    return periods.reduce((total, period) => total + (period.investments[assetId] || 0), 0);
  }
  return Math.max(0, ledger.plans[assetId]?.monthlyBudget || 0);
}

function cashFlowForMonth(ledger: Ledger, month: string) {
  const periods = activeBudgetPeriods(ledger, month);
  if (periods.length === 0) {
    return Math.max(0, ledger.plans.cash?.monthlyBudget || 0);
  }
  const investmentExpense = ledger.assets
    .filter((asset) => asset.id !== "cash")
    .reduce((total, asset) => total + budgetForMonth(ledger, month, asset.id), 0);
  const income = periods.reduce((total, period) => total + period.income, 0);
  const expense = periods.reduce((total, period) => total + period.expense, 0);
  return income - expense - investmentExpense;
}

function hasNegativeForecast(ledger: Ledger, latestMonth: string, forecastMonths: string[]) {
  const balances = new Map(
    ledger.assets.map((asset) => [asset.id, ledger.values[latestMonth]?.[asset.id] || 0]),
  );

  for (const month of forecastMonths) {
    for (const asset of ledger.assets) {
      const plan = ledger.plans[asset.id] || { monthlyBudget: 0, annualRate: 0 };
      const contribution = asset.id === "cash"
        ? cashFlowForMonth(ledger, month)
        : budgetForMonth(ledger, month, asset.id);
      const next = ((balances.get(asset.id) || 0) + contribution)
        * (1 + monthlyRateFromAnnualRate(plan.annualRate));
      if (next < 0) return true;
      balances.set(asset.id, next);
    }
  }

  return false;
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

  const legacyGroups = candidate as Partial<Ledger> & { otherGroups?: unknown };
  const rawBudgetGroups = Array.isArray(candidate.budgetGroups)
    ? candidate.budgetGroups
    : Array.isArray(legacyGroups.otherGroups)
      ? legacyGroups.otherGroups
      : [];
  const budgetGroups: BudgetGroup[] = rawBudgetGroups.flatMap((rawGroup) => {
        if (!rawGroup || typeof rawGroup !== "object") return [];
        const group = rawGroup as Partial<BudgetGroup>;
        if (typeof group.id !== "string" || typeof group.name !== "string") return [];
        const name = group.name.trim();
        return name ? [{
          id: group.id,
          name,
          category: (group.category === "budget" ? "budget" : "other") as BudgetCategory,
        }] : [];
      })
  const groupCategories = new Map(budgetGroups.map((group) => [group.id, group.category]));

  const budgetPeriods = Array.isArray(candidate.budgetPeriods)
    ? candidate.budgetPeriods.flatMap((rawPeriod) => {
        if (!rawPeriod || typeof rawPeriod !== "object") return [];
        const period = rawPeriod as Partial<BudgetPeriod>;
        if (
          typeof period.id !== "string" ||
          !validMonth(period.startMonth) ||
          !validMonth(period.endMonth) ||
          period.startMonth > period.endMonth
        ) {
          return [];
        }
        const amount = (value: unknown) =>
          typeof value === "number" && Number.isFinite(value) ? value : 0;
        const investments = Object.fromEntries(
          (assets as Asset[])
            .filter((asset) => asset.id !== "cash")
            .map((asset) => [asset.id, amount(period.investments?.[asset.id])]),
        );
        const category = (period.category === "other" || (!period.category && period.mode === "single")
          ? "other"
          : "budget") as BudgetCategory;
        return [{
          id: period.id,
          category,
          groupId: typeof period.groupId === "string" && groupCategories.get(period.groupId) === category
            ? period.groupId
            : undefined,
          mode: (period.mode === "single" ? "single" : "range") as BudgetPeriod["mode"],
          memo: typeof period.memo === "string" ? period.memo : "",
          startMonth: period.startMonth,
          endMonth: period.endMonth,
          income: amount(period.income),
          expense: amount(period.expense),
          investments,
        }];
      })
    : [];

  return {
    assets: assets as Asset[],
    selectedMonth,
    inputMonths,
    values,
    plans,
    budgetGroups,
    budgetPeriods,
  };
}

function createAccountStore(primary = createInitialLedger()): AccountStore {
  return {
    activeAccount: "primary",
    accounts: {
      primary,
      secondary: createInitialLedger(),
    },
  };
}

function restoreAccountStore(input: unknown): AccountStore | null {
  if (!input || typeof input !== "object" || !("accounts" in input)) return null;
  const candidate = input as Partial<AccountStore>;
  if (!candidate.accounts || typeof candidate.accounts !== "object") return null;
  const primary = restoreLedger(candidate.accounts.primary);
  const secondary = restoreLedger(candidate.accounts.secondary);
  if (!primary || !secondary) return null;
  return {
    activeAccount: candidate.activeAccount === "secondary" ? "secondary" : "primary",
    accounts: { primary, secondary },
  };
}

type CloudAccountStore = Pick<AccountStore, "accounts">;

function cloudSnapshot(store: AccountStore): CloudAccountStore {
  return JSON.parse(JSON.stringify({ accounts: store.accounts })) as CloudAccountStore;
}

function isSharedUser(user: User | null) {
  return Boolean(user?.email && SHARED_EMAILS.includes(user.email));
}

function AssetChart({
  ledger,
  months,
  forecastMonths,
  selectedAssetId,
  onSelectAsset,
  showAmounts,
}: {
  ledger: Ledger;
  months: string[];
  forecastMonths: string[];
  selectedAssetId: string | null;
  onSelectAsset: (assetId: string) => void;
  showAmounts: boolean;
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
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const actualTotals = months.map((month) =>
    displayedAssets.reduce(
      (total, asset) => total + (ledger.values[month]?.[asset.id] || 0),
      0,
    ),
  );
  const latestMonth = months.at(-1) || ledger.selectedMonth;
  const forecastByAssetId = new Map<string, number[]>();
  const runningBalances = new Map(
    ledger.assets.map((asset) => [asset.id, ledger.values[latestMonth]?.[asset.id] || 0]),
  );
  ledger.assets.forEach((asset) => forecastByAssetId.set(asset.id, []));
  forecastMonths.forEach((month) => {
    ledger.assets.forEach((asset) => {
      const plan = ledger.plans[asset.id] || { monthlyBudget: 0, annualRate: 0 };
      const current = runningBalances.get(asset.id) || 0;
      const contribution = asset.id === "cash"
        ? cashFlowForMonth(ledger, month)
        : budgetForMonth(ledger, month, asset.id);
      const next = (current + contribution) * (1 + monthlyRateFromAnnualRate(plan.annualRate));
      runningBalances.set(asset.id, next);
      forecastByAssetId.get(asset.id)?.push(next);
    });
  });
  const forecastValues = displayedAssets.map((asset) => forecastByAssetId.get(asset.id) || []);
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
  const hoveredMonth = hoverIndex === null ? null : displayMonths[hoverIndex];
  const hoveredIsForecast = hoverIndex !== null && hoverIndex >= months.length;
  const tooltipValues = hoverIndex === null
    ? []
    : ledger.assets.map((asset) => ({
        asset,
        value: hoverIndex < months.length
          ? ledger.values[displayMonths[hoverIndex]]?.[asset.id] || 0
          : forecastByAssetId.get(asset.id)?.[hoverIndex - months.length] || 0,
      }));
  const tooltipTotal = tooltipValues.reduce((total, { value }) => total + value, 0);
  const hoveredX = hoverIndex === null ? 0 : xFor(hoverIndex);
  const tooltipLeft = Math.min(84, Math.max(16, (hoveredX / width) * 100));

  return (
    <div className="chart-wrap">
      <svg
        className="asset-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${monthLabel(months[0])}から${monthLabel(forecastMonths.at(-1) || latestMonth)}までの積み上げ資産推移と予測`}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const pointX = ((event.clientX - bounds.left) / bounds.width) * width;
          const index = displayMonths.length === 1
            ? 0
            : Math.round(((pointX - plot.left) / chartWidth) * (displayMonths.length - 1));
          setHoverIndex(Math.max(0, Math.min(displayMonths.length - 1, index)));
        }}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {[0, 0.5, 1].map((ratio) => {
          const y = plot.top + chartHeight * (1 - ratio);
          return (
            <g key={ratio}>
              <line x1={plot.left} x2={width - plot.right} y1={y} y2={y} className="grid-line" />
              <text x={plot.left - 12} y={y + 4} textAnchor="end" className="axis-text">
                {showAmounts ? formatAxis(maximum * ratio) : "—"}
              </text>
            </g>
          );
        })}

        {hoverIndex !== null && (
          <line
            className="hover-guide"
            x1={hoveredX}
            x2={hoveredX}
            y1={plot.top}
            y2={plot.top + chartHeight}
          />
        )}

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

        {actualSeries.map(({ asset, line }) => (
          <g key={asset.id}>
            <path d={line} stroke={asset.color} className="series-line" />
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

        {forecastSeries.map(({ asset, line }) => (
          <g key={`${asset.id}-forecast`}>
            <path d={line} stroke={asset.color} className="forecast-line" />
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
      {hoveredMonth && (
        <div
          className="chart-tooltip"
          role="status"
          style={{ left: `${tooltipLeft}%` }}
        >
          <p>
            {monthLabel(hoveredMonth)}
            {hoveredIsForecast && <span>予測</span>}
          </p>
          <div className="tooltip-total">
            <span>資産合計</span>
            <strong>{displayedYen(Math.round(tooltipTotal), showAmounts)}円</strong>
          </div>
          <ul>
            {tooltipValues.map(({ asset, value }) => (
              <li key={asset.id}>
                <span className="tooltip-name">
                  <i style={{ background: asset.color }} aria-hidden="true" />
                  {asset.name || "名称未設定"}
                </span>
                <strong>{displayedYen(Math.round(value), showAmounts)}円</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [accountStore, setAccountStore] = useState<AccountStore>(() => createAccountStore(initialLedger));
  const [activeAccount, setActiveAccount] = useState<AccountId>("primary");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("assets");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [chartRange, setChartRange] = useState<ChartRange>("S");
  const [planSortOrder, setPlanSortOrder] = useState<PlanSortOrder>("asc");
  const [draggedAssetId, setDraggedAssetId] = useState<string | null>(null);
  const [dropTargetAssetId, setDropTargetAssetId] = useState<string | null>(null);
  const [newGroupNames, setNewGroupNames] = useState<Record<BudgetCategory, string>>({
    budget: "",
    other: "",
  });
  const [showAmounts, setShowAmounts] = useState(true);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(true);
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  const [syncError, setSyncError] = useState("");
  const [backupStatus, setBackupStatus] = useState("");
  const newestNameRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [focusNewest, setFocusNewest] = useState(false);
  const accountStoreRef = useRef(accountStore);
  const activeAccountRef = useRef(activeAccount);
  const cloudReadyRef = useRef(false);
  const lastCloudSignatureRef = useRef<string | null>(null);
  const pendingLocalChangeRef = useRef(false);
  const ledger = accountStore.accounts[activeAccount];

  useEffect(() => {
    const savedVisibility = window.localStorage.getItem(AMOUNT_VISIBILITY_KEY);
    if (savedVisibility !== null) setShowAmounts(savedVisibility === "true");
  }, []);

  const toggleAmountVisibility = () => {
    setShowAmounts((current) => {
      const next = !current;
      window.localStorage.setItem(AMOUNT_VISIBILITY_KEY, String(next));
      return next;
    });
  };
  const setLedger = (update: SetStateAction<Ledger>) => {
    pendingLocalChangeRef.current = true;
    setAccountStore((current) => {
      const currentLedger = current.accounts[activeAccount];
      const nextLedger = typeof update === "function" ? update(currentLedger) : update;
      return {
        ...current,
        accounts: { ...current.accounts, [activeAccount]: nextLedger },
      };
    });
  };

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

  const switchAccount = (account: AccountId) => {
    setActiveAccount(account);
    setSelectedAssetId(null);
    setBackupStatus("");
  };

  const signInForSync = async () => {
    setSyncStatus("connecting");
    setSyncError("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (!isSharedUser(result.user)) {
        await signOut(auth);
        throw new Error("このGoogleアカウントには共有が許可されていません。");
      }
    } catch (error) {
      setSyncStatus("error");
      setSyncError(error instanceof Error ? error.message : "Googleログインに失敗しました。");
    }
  };

  const signOutFromSync = async () => {
    await signOut(auth);
    setSyncStatus("local");
    setSyncError("");
  };

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    tab: WorkspaceTab,
  ) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const tabs: WorkspaceTab[] = ["assets", "plans", "settings", "data"];
    const currentIndex = tabs.indexOf(tab);
    const direction = event.key === "ArrowRight" ? 1 : -1;
    changeTab(tabs[(currentIndex + direction + tabs.length) % tabs.length], event);
  };

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as unknown;
        const restoredAccounts = restoreAccountStore(parsed);
        if (restoredAccounts) {
          setAccountStore(restoredAccounts);
          setActiveAccount(restoredAccounts.activeAccount);
        } else {
          const restored = restoreLedger(parsed);
          if (restored) setAccountStore(createAccountStore(restored));
        }
      }
    } catch {
      // If this new-format record is damaged, start with a fresh July 2026 ledger.
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    accountStoreRef.current = accountStore;
  }, [accountStore]);

  useEffect(() => {
    activeAccountRef.current = activeAccount;
  }, [activeAccount]);

  useEffect(() => {
    if (!ready) return;
    setSaved(false);
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...accountStore,
        activeAccount,
      }));
      setSaved(true);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [accountStore, activeAccount, ready]);

  useEffect(() => {
    if (!ready) return;

    return onAuthStateChanged(auth, (user) => {
      cloudReadyRef.current = false;
      lastCloudSignatureRef.current = null;
      pendingLocalChangeRef.current = false;
      setCloudUser(user);
      if (!user) {
        setSyncStatus("local");
        return;
      }
      if (!isSharedUser(user)) {
        setSyncStatus("error");
        setSyncError("このGoogleアカウントには共有が許可されていません。");
        void signOut(auth);
        return;
      }

      setSyncStatus("connecting");
      const unsubscribe = onSnapshot(
        CLOUD_DOCUMENT,
        async (snapshot) => {
          try {
            if (snapshot.exists()) {
              const restored = restoreAccountStore(snapshot.data().accounts);
              if (!restored) throw new Error("クラウド上のデータ形式を読み取れませんでした。");
              const restoredState = cloudSnapshot(restored);
              const remoteSignature = JSON.stringify(restoredState);
              const localSignature = JSON.stringify(cloudSnapshot(accountStoreRef.current));

              // 入力直後は、書き込み待ちのローカル値を古いスナップショットで上書きしない。
              if (pendingLocalChangeRef.current && remoteSignature !== localSignature) {
                cloudReadyRef.current = true;
                setSyncStatus("saving");
                await setDoc(CLOUD_DOCUMENT, {
                  version: 1,
                  accounts: cloudSnapshot(accountStoreRef.current),
                  updatedAt: serverTimestamp(),
                  updatedBy: user.email,
                });
                lastCloudSignatureRef.current = localSignature;
                return;
              }

              pendingLocalChangeRef.current = false;
              lastCloudSignatureRef.current = remoteSignature;
              setAccountStore((current) => ({
                ...restored,
                activeAccount: current.activeAccount,
              }));
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
                ...restored,
                activeAccount: activeAccountRef.current,
              }));
            } else {
              const localState = cloudSnapshot(accountStoreRef.current);
              await setDoc(CLOUD_DOCUMENT, {
                version: 1,
                accounts: localState,
                updatedAt: serverTimestamp(),
                updatedBy: user.email,
              });
              lastCloudSignatureRef.current = JSON.stringify(localState);
            }
            cloudReadyRef.current = true;
            setSyncStatus("synced");
            setSyncError("");
          } catch (error) {
            cloudReadyRef.current = false;
            setSyncStatus("error");
            setSyncError(error instanceof Error ? error.message : "クラウド同期に失敗しました。");
          }
        },
        (error) => {
          cloudReadyRef.current = false;
          setSyncStatus("error");
          setSyncError(error.message || "クラウド同期に失敗しました。");
        },
      );
      return unsubscribe;
    });
  }, [ready]);

  useEffect(() => {
    if (!ready || !cloudUser || !cloudReadyRef.current) return;
    const state = cloudSnapshot(accountStore);
    const signature = JSON.stringify(state);
    if (signature === lastCloudSignatureRef.current) return;

    const timer = window.setTimeout(async () => {
      setSyncStatus("saving");
      try {
        await setDoc(CLOUD_DOCUMENT, {
          version: 1,
          accounts: state,
          updatedAt: serverTimestamp(),
          updatedBy: cloudUser.email,
        });
        lastCloudSignatureRef.current = signature;
        setSyncStatus("synced");
        setSyncError("");
      } catch (error) {
        setSyncStatus("error");
        setSyncError(error instanceof Error ? error.message : "クラウド同期に失敗しました。");
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [accountStore, cloudUser, ready]);

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
    const plannedEnd = ledger.budgetPeriods
      .map((period) => period.endMonth)
      .filter((month) => month > latestMonth)
      .sort()
      .at(-1);
    const endMonth = plannedEnd && plannedEnd > shiftMonth(latestMonth, 180)
      ? plannedEnd
      : shiftMonth(latestMonth, 180);
    return monthRange(shiftMonth(latestMonth, 1), endMonth);
  }, [ledger.budgetPeriods, ledger.inputMonths, ledger.selectedMonth]);

  const visibleMonths = useMemo(
    () => months.slice(-CHART_RANGE_MONTHS[chartRange]),
    [chartRange, months],
  );
  const visibleForecastMonths = useMemo(
    () => forecastMonths.slice(0, CHART_RANGE_MONTHS[chartRange]),
    [chartRange, forecastMonths],
  );
  const hasForecastWarning = useMemo(() => {
    const latestMonth = ledger.inputMonths.at(-1) || ledger.selectedMonth;
    return hasNegativeForecast(ledger, latestMonth, forecastMonths);
  }, [forecastMonths, ledger]);
  const orderedBudgetPeriods = (category: BudgetCategory) =>
    ledger.budgetPeriods
      .filter((period) => period.category === category)
      .sort((a, b) => {
        const groups = ledger.budgetGroups.filter((group) => group.category === category);
        const groupA = groups.findIndex((group) => group.id === a.groupId);
        const groupB = groups.findIndex((group) => group.id === b.groupId);
        const normalizedA = groupA < 0 ? Number.MAX_SAFE_INTEGER : groupA;
        const normalizedB = groupB < 0 ? Number.MAX_SAFE_INTEGER : groupB;
        if (normalizedA !== normalizedB) return normalizedA - normalizedB;
        return planSortOrder === "asc"
          ? a.startMonth.localeCompare(b.startMonth)
          : b.startMonth.localeCompare(a.startMonth);
      });
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

  const addBudgetPeriod = (category: BudgetCategory, groupId?: string) => {
    setLedger((current) => {
      const latestMonth = current.inputMonths.at(-1) || current.selectedMonth;
      const latestPlannedEnd = current.budgetPeriods
        .filter((period) => period.category === category)
        .map((period) => period.endMonth)
        .sort()
        .at(-1);
      const startMonth = shiftMonth(latestPlannedEnd || latestMonth, 1);
      return {
        ...current,
        budgetPeriods: [
          ...current.budgetPeriods,
          {
            id: `period-${category}-${Date.now()}`,
            category,
            groupId,
            mode: "range",
            memo: "",
            startMonth,
            endMonth: shiftMonth(startMonth, 11),
            income: 0,
            expense: 0,
            investments: Object.fromEntries(
              current.assets
                .filter((asset) => asset.id !== "cash")
                .map((asset) => [asset.id, 0]),
            ),
          },
        ],
      };
    });
  };

  const updateBudgetPeriod = (
    category: BudgetCategory,
    periodId: string,
    change: Partial<Omit<BudgetPeriod, "id" | "category" | "investments">>,
  ) => {
    setLedger((current) => ({
      ...current,
      budgetPeriods: current.budgetPeriods.map((period) => {
        if (period.category !== category || period.id !== periodId) return period;
        const next = { ...period, ...change };
        if (next.mode === "single") next.endMonth = next.startMonth;
        if (next.startMonth > next.endMonth) {
          if (change.startMonth) next.endMonth = next.startMonth;
          if (change.endMonth) next.startMonth = next.endMonth;
        }
        return next;
      }),
    }));
  };

  const setBudgetAmount = (
    category: BudgetCategory,
    periodId: string,
    field: "income" | "expense" | "investment",
    rawValue: string,
    assetId?: string,
  ) => {
    const normalized = rawValue.replace(/[^0-9-]/g, "");
    const digits = normalized.replace(/-/g, "");
    const parsed = digits === "" ? 0 : Number(`${normalized.includes("-") ? "-" : ""}${digits}`);
    const value = Number.isFinite(parsed) ? parsed : 0;
    setLedger((current) => ({
      ...current,
      budgetPeriods: current.budgetPeriods.map((period) => {
        if (period.category !== category || period.id !== periodId) return period;
        if (field === "investment" && assetId) {
          return { ...period, investments: { ...period.investments, [assetId]: value } };
        }
        return { ...period, [field]: value };
      }),
    }));
  };

  const removeBudgetPeriod = (category: BudgetCategory, periodId: string) => {
    const period = ledger.budgetPeriods.find(
      (item) => item.category === category && item.id === periodId,
    );
    if (!period) return;
    const periodLabel = period.mode === "single"
      ? monthLabel(period.startMonth)
      : `${monthLabel(period.startMonth)}〜${monthLabel(period.endMonth)}`;
    if (!window.confirm(`${periodLabel}の計画を削除しますか？\nこの操作は元に戻せません。`)) return;
    setLedger((current) => ({
      ...current,
      budgetPeriods: current.budgetPeriods.filter(
        (period) => period.category !== category || period.id !== periodId,
      ),
    }));
  };

  const duplicateBudgetPeriod = (category: BudgetCategory, periodId: string) => {
    setLedger((current) => {
      const source = current.budgetPeriods.find(
        (period) => period.category === category && period.id === periodId,
      );
      if (!source) return current;
      return {
        ...current,
        budgetPeriods: [
          ...current.budgetPeriods,
          {
            ...source,
            id: `period-${category}-${Date.now()}`,
            investments: { ...source.investments },
          },
        ],
      };
    });
  };

  const addBudgetGroup = (category: BudgetCategory) => {
    const name = newGroupNames[category].trim();
    if (!name) return;
    setLedger((current) => ({
      ...current,
      budgetGroups: [
        ...current.budgetGroups,
        { id: `group-${category}-${Date.now()}`, name, category },
      ],
    }));
    setNewGroupNames((current) => ({ ...current, [category]: "" }));
  };

  const renameBudgetGroup = (groupId: string, name: string) => {
    setLedger((current) => ({
      ...current,
      budgetGroups: current.budgetGroups.map((group) => (
        group.id === groupId ? { ...group, name: name.trim() || "名称未設定" } : group
      )),
    }));
  };

  const removeBudgetGroup = (groupId: string) => {
    const group = ledger.budgetGroups.find((item) => item.id === groupId);
    if (!group) return;
    const periodCount = ledger.budgetPeriods.filter(
      (period) => period.category === group.category && period.groupId === groupId,
    ).length;
    const message = periodCount > 0
      ? `「${group.name}」を削除しますか？\n${periodCount}件の予算は未分類になります。`
      : `「${group.name}」を削除しますか？`;
    if (!window.confirm(`${message}\nこの操作は元に戻せません。`)) return;
    setLedger((current) => ({
      ...current,
      budgetGroups: current.budgetGroups.filter((group) => group.id !== groupId),
      budgetPeriods: current.budgetPeriods.map((period) => (
        period.groupId === groupId ? { ...period, groupId: undefined } : period
      )),
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
    const asset = ledger.assets.find((item) => item.id === assetId);
    if (!asset) return;
    if (!window.confirm(`「${asset.name || "名称未設定"}」を削除しますか？\nこの操作は元に戻せません。`)) return;
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

  const reorderAssets = (sourceId: string, destinationId: string) => {
    if (sourceId === destinationId) return;
    setLedger((current) => {
      const source = current.assets.find((asset) => asset.id === sourceId);
      if (!source) return current;
      const remaining = current.assets.filter((asset) => asset.id !== sourceId);
      const destinationIndex = remaining.findIndex((asset) => asset.id === destinationId);
      if (destinationIndex < 0) return current;
      return {
        ...current,
        assets: [
          ...remaining.slice(0, destinationIndex),
          source,
          ...remaining.slice(destinationIndex),
        ],
      };
    });
  };

  const saveBackup = () => {
    const backup: Backup = {
      app: "Finance",
      version: 2,
      exportedAt: new Date().toISOString(),
      accounts: { ...accountStore, activeAccount },
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
      if (!window.confirm("現在のデータをバックアップ内容で置き換えます。よろしいですか？")) {
        setBackupStatus("読み込みをキャンセルしました");
        return;
      }
      const backupAccounts =
        parsed && typeof parsed === "object" && "accounts" in parsed &&
        (parsed as { accounts?: unknown }).accounts &&
        typeof (parsed as { accounts?: unknown }).accounts === "object" &&
        "activeAccount" in ((parsed as { accounts: object }).accounts)
          ? (parsed as { accounts: unknown }).accounts
          : parsed;
      const restoredAccounts = restoreAccountStore(backupAccounts);
      if (restoredAccounts) {
        setAccountStore(restoredAccounts);
        setActiveAccount(restoredAccounts.activeAccount);
      } else {
        const restored = restoreLedger(
          parsed && typeof parsed === "object" && "ledger" in parsed
            ? (parsed as { ledger?: unknown }).ledger
            : parsed,
        );
        if (!restored) throw new Error("invalid backup");
        setLedger(restored);
      }
      setSelectedAssetId(null);
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
            aria-label="資産"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 18V6m0 12h16M7 14l4-4 3 2 5-6" />
            </svg>
            <span className="tab-label">
              <span className="tab-text">資産</span>
              {hasForecastWarning && (
                <span className="tab-alert" aria-label="予測に警告があります">!</span>
              )}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            data-tab="plans"
            aria-selected={activeTab === "plans"}
            tabIndex={activeTab === "plans" ? 0 : -1}
            className={activeTab === "plans" ? "is-active" : ""}
            onClick={() => changeTab("plans")}
            onKeyDown={(event) => handleTabKeyDown(event, "plans")}
            aria-label="計画"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 18V6m0 12h16M7 14l4-4 3 2 5-6" />
            </svg>
            <span className="tab-text">計画</span>
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
            aria-label="設定"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.4-6.4-2.1 2.1M7.7 16.3l-2.1 2.1m12.8 0-2.1-2.1M7.7 7.7 5.6 5.6" />
            </svg>
            <span className="tab-text">設定</span>
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
            aria-label="データ管理"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 5h14v14H5zM8 5v5h8V5M8 19v-5h8v5" />
            </svg>
            <span className="tab-text">データ管理</span>
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
                : activeTab === "plans"
                  ? "計画"
                  : activeTab === "settings"
                  ? "設定"
                  : "データ管理"}
            </strong>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="amount-visibility-toggle"
              aria-pressed={!showAmounts}
              aria-label={showAmounts ? "金額を非表示にする" : "金額を表示する"}
              title={showAmounts ? "金額を非表示" : "金額を表示"}
              onClick={toggleAmountVisibility}
            >
              {showAmounts ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2.5 12s3.4-5.5 9.5-5.5S21.5 12 21.5 12 18.1 17.5 12 17.5 2.5 12 2.5 12Z" />
                  <circle cx="12" cy="12" r="2.7" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m3 3 18 18M10.6 6.7A10.2 10.2 0 0 1 12 6.5c6.1 0 9.5 5.5 9.5 5.5a17.7 17.7 0 0 1-3.3 3.8M6.2 6.2A17.4 17.4 0 0 0 2.5 12s3.4 5.5 9.5 5.5c1.2 0 2.2-.2 3.1-.5M9.8 9.8a3.1 3.1 0 0 0 4.4 4.4" />
                </svg>
              )}
            </button>
            <div className="account-switch" role="group" aria-label="アカウントを切り替え">
              {(["primary", "secondary"] as AccountId[]).map((account) => (
                <button
                  type="button"
                  key={account}
                  className={activeAccount === account ? "is-active" : ""}
                  aria-pressed={activeAccount === account}
                  onClick={() => switchAccount(account)}
                >
                  {ACCOUNT_LABELS[account]}
                </button>
              ))}
            </div>
            {cloudUser ? (
              <div className="sync-control is-synced" title={cloudUser.email || ""}>
                <span className={syncStatus === "synced" ? "status-dot is-saved" : "status-dot"} aria-hidden="true" />
                <span>{syncStatus === "saving" ? "同期中" : "同期済み"}</span>
                <button type="button" onClick={() => void signOutFromSync()}>ログアウト</button>
              </div>
            ) : (
              <button type="button" className="sync-control" onClick={() => void signInForSync()}>
                {syncStatus === "connecting" ? "接続中…" : "Googleで同期"}
              </button>
            )}
            <span className="save-badge">
              <span className={saved ? "status-dot is-saved" : "status-dot"} aria-hidden="true" />
              {saved ? "保存済み" : "保存中"}
            </span>
          </div>
        </header>
        {syncError && <p className="sync-error" role="alert">{syncError}</p>}

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
                  <div className="chart-title-row">
                    <h2 id="chart-title">資産の推移</h2>
                    {hasForecastWarning && (
                      <span className="forecast-warning" role="status">
                        予測上、残高が不足する月があります
                      </span>
                    )}
                  </div>
                  <p>
                    実績 {monthLabel(visibleMonths[0])} — {monthLabel(visibleMonths.at(-1) || visibleMonths[0])}
                    <span aria-hidden="true"> / </span>
                    予測 {monthLabel(visibleForecastMonths.at(-1) || visibleMonths[0])}まで
                  </p>
                </div>
                <div className="range-switch" role="group" aria-label="グラフの表示期間">
                  {([
                    ["S", "1年"],
                    ["L", "5年"],
                    ["LL", "15年"],
                  ] as const).map(([range, label]) => (
                    <button
                      aria-label={`${label}表示`}
                      aria-pressed={chartRange === range}
                      className={chartRange === range ? "is-active" : ""}
                      key={range}
                      onClick={() => setChartRange(range)}
                      title={`${label}表示`}
                      type="button"
                    >
                      <strong>{range}</strong>
                      <span>{label}</span>
                    </button>
                  ))}
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
                months={visibleMonths}
                forecastMonths={visibleForecastMonths}
                selectedAssetId={selectedAssetId}
                showAmounts={showAmounts}
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
                  <article
                    aria-label={`${asset.name || `資産項目${index + 1}`}。ドラッグして並び替え`}
                    className={`asset-field${draggedAssetId === asset.id ? " is-dragging" : ""}${dropTargetAssetId === asset.id ? " is-drop-target" : ""}`}
                    draggable
                    key={asset.id}
                    onDragEnd={() => {
                      setDraggedAssetId(null);
                      setDropTargetAssetId(null);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (draggedAssetId && draggedAssetId !== asset.id) {
                        setDropTargetAssetId(asset.id);
                      }
                    }}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      setDraggedAssetId(asset.id);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (draggedAssetId) reorderAssets(draggedAssetId, asset.id);
                      setDraggedAssetId(null);
                      setDropTargetAssetId(null);
                    }}
                  >
                    <div className="asset-name-row">
                      <span className="drag-handle" aria-hidden="true">⠿</span>
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
                      <CurrencyInput
                        className="amount-input"
                        value={selectedValues[asset.id] || 0}
                        hasValue={asset.id in selectedValues}
                        showAmounts={showAmounts}
                        readOnly={!showAmounts}
                        onValueChange={(value) => setAmount(asset.id, value)}
                        ariaLabel={`${asset.name || `資産項目${index + 1}`}の金額`}
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
          ) : activeTab === "plans" ? (
            <>
              <header className="page-header">
                <div>
                  <h1>計画</h1>
                  <p>期間ごとの収入・支出・投資予算を設定します</p>
                </div>
              </header>
              <div className="planning-sections">
              {(["budget", "other"] as BudgetCategory[]).map((category) => {
                const periods = orderedBudgetPeriods(category);
                const title = category === "budget" ? "予算" : "その他";
                return (
              <section className="planning-panel" aria-labelledby={`planning-${category}-title`} key={category}>
                <div className="settings-heading">
                  <div>
                    <h2 id={`planning-${category}-title`}>{title}</h2>
                    <p>収入から支出と投資予算を差し引いた額を、現金の予測へ反映します。</p>
                  </div>
                  <div className="planning-actions">
                  <button type="button" className="add-period" onClick={() => addBudgetPeriod(category)}>
                    期間を追加
                  </button>
                  {periods.length > 1 && (
                    <div className="plan-sort" role="group" aria-label="計画の並び順">
                      <button
                        type="button"
                        className={planSortOrder === "asc" ? "is-active" : ""}
                        aria-pressed={planSortOrder === "asc"}
                        onClick={() => setPlanSortOrder("asc")}
                      >
                        開始月：昇順
                      </button>
                      <button
                        type="button"
                        className={planSortOrder === "desc" ? "is-active" : ""}
                        aria-pressed={planSortOrder === "desc"}
                        onClick={() => setPlanSortOrder("desc")}
                      >
                        降順
                      </button>
                    </div>
                  )}
                  </div>
                </div>
                <div className="other-group-manager" aria-label={`${title}のグループ`}>
                    <div className="other-group-create">
                      <input
                        type="text"
                        value={newGroupNames[category]}
                        placeholder="グループ名"
                        onChange={(event) => setNewGroupNames((current) => ({
                          ...current,
                          [category]: event.target.value,
                        }))}
                        aria-label={`新しい${title}グループ名`}
                      />
                      <button type="button" onClick={() => addBudgetGroup(category)} disabled={!newGroupNames[category].trim()}>
                        グループを追加
                      </button>
                    </div>
                    {ledger.budgetGroups.some((group) => group.category === category) && (
                      <div className="other-group-list">
                        {ledger.budgetGroups.filter((group) => group.category === category).map((group) => (
                          <div className="other-group-item" key={group.id}>
                            <input
                              type="text"
                              value={group.name}
                              onChange={(event) => renameBudgetGroup(group.id, event.target.value)}
                              aria-label={`${group.name}のグループ名`}
                            />
                            <span>{ledger.budgetPeriods.filter((period) => period.category === category && period.groupId === group.id).length}件</span>
                            <button type="button" onClick={() => addBudgetPeriod(category, group.id)}>
                              追加
                            </button>
                            <button type="button" className="remove-group" onClick={() => removeBudgetGroup(group.id)}>
                              削除
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                {periods.length === 0 ? (
                  <div className="empty-plan">
                    <p>設定済みの期間はありません。</p>
                    <button type="button" onClick={() => addBudgetPeriod(category)}>最初の期間を追加</button>
                  </div>
                ) : (
                  <div className="budget-periods">
                    {periods.map((period) => {
                      const investmentTotal = ledger.assets
                        .filter((asset) => asset.id !== "cash")
                        .reduce((total, asset) => total + (period.investments[asset.id] || 0), 0);
                      return (
                        <details className="budget-period" key={period.id}>
                          <summary>
                            <span>
                              {period.mode === "single"
                                ? monthLabel(period.startMonth)
                                : `${monthLabel(period.startMonth)} 〜 ${monthLabel(period.endMonth)}`}
                            </span>
                            <span className="period-summary-memo">
                              {period.memo || "メモなし"}
                            </span>
                            {period.groupId && (
                              <span className="period-summary-group">
                                {ledger.budgetGroups.find((group) => group.id === period.groupId)?.name || "未分類"}
                              </span>
                            )}
                          </summary>
                          <div className="period-body">
                            <fieldset className="period-mode">
                              <legend>計画の期間</legend>
                              <label>
                                <input
                                  type="radio"
                                  name={`${period.id}-mode`}
                                  checked={period.mode === "single"}
                                  onChange={() => updateBudgetPeriod(category, period.id, { mode: "single" })}
                                />
                                単月
                              </label>
                              <label>
                                <input
                                  type="radio"
                                  name={`${period.id}-mode`}
                                  checked={period.mode === "range"}
                                  onChange={() => updateBudgetPeriod(category, period.id, { mode: "range" })}
                                />
                                複数月
                              </label>
                            </fieldset>
                            <div className="period-header">
                            <div className="period-range">
                              <label>
                                <span className="sr-only">開始月</span>
                                <input
                                  type="month"
                                  min={EARLIEST_MONTH}
                                  value={period.startMonth}
                                  onChange={(event) => updateBudgetPeriod(category, period.id, { startMonth: event.target.value })}
                                />
                              </label>
                              {period.mode === "range" && (
                                <>
                                  <span aria-hidden="true">〜</span>
                                  <label>
                                    <span className="sr-only">終了月</span>
                                    <input
                                      type="month"
                                      min={period.startMonth}
                                      value={period.endMonth}
                                      onChange={(event) => updateBudgetPeriod(category, period.id, { endMonth: event.target.value })}
                                    />
                                  </label>
                                </>
                              )}
                            </div>
                            <div className="period-actions">
                              <button
                                type="button"
                                className="duplicate-period"
                                onClick={() => duplicateBudgetPeriod(category, period.id)}
                                aria-label={`${monthLabel(period.startMonth)}から${monthLabel(period.endMonth)}の計画を複製`}
                              >
                                複製
                              </button>
                              <button
                                type="button"
                                className="remove-period"
                                onClick={() => removeBudgetPeriod(category, period.id)}
                                aria-label={`${monthLabel(period.startMonth)}から${monthLabel(period.endMonth)}の計画を削除`}
                              >
                                削除
                              </button>
                            </div>
                            </div>
                            <label className="period-memo">
                              <span>メモ</span>
                              <input
                                type="text"
                                value={period.memo}
                                placeholder="例：夏季の旅行費用を含む"
                                onChange={(event) => updateBudgetPeriod(category, period.id, { memo: event.target.value })}
                                aria-label={`${monthLabel(period.startMonth)}からの計画メモ`}
                              />
                            </label>
                            <label className="period-group-select">
                              <span>グループ</span>
                              <select
                                value={period.groupId || ""}
                                onChange={(event) => updateBudgetPeriod(category, period.id, {
                                  groupId: event.target.value || undefined,
                                })}
                                aria-label={`${monthLabel(period.startMonth)}からの${title}グループ`}
                              >
                                <option value="">未分類</option>
                                {ledger.budgetGroups.filter((group) => group.category === category).map((group) => (
                                  <option key={group.id} value={group.id}>{group.name}</option>
                                ))}
                              </select>
                            </label>
                            <div className="period-budget-grid">
                            <label className="period-budget income">
                              <span>収入</span>
                              <span className="plan-input-wrap">
                                <CurrencyInput
                                  value={period.income}
                                  showAmounts={showAmounts}
                                  readOnly={!showAmounts}
                                  allowNegative
                                  onValueChange={(value) => setBudgetAmount(category, period.id, "income", value)}
                                  ariaLabel={`${monthLabel(period.startMonth)}からの収入予算`}
                                />
                                <span>円</span>
                              </span>
                            </label>
                            <label className="period-budget expense">
                              <span>支出</span>
                              <span className="plan-input-wrap">
                                <CurrencyInput
                                  value={period.expense}
                                  showAmounts={showAmounts}
                                  readOnly={!showAmounts}
                                  allowNegative
                                  onValueChange={(value) => setBudgetAmount(category, period.id, "expense", value)}
                                  ariaLabel={`${monthLabel(period.startMonth)}からの支出予算`}
                                />
                                <span>円</span>
                              </span>
                            </label>
                            {ledger.assets.filter((asset) => asset.id !== "cash").map((asset) => (
                              <label className="period-budget" key={asset.id}>
                                <span className="budget-label">
                                  <i style={{ background: asset.color }} aria-hidden="true" />
                                  {asset.name || "名称未設定"}
                                </span>
                                <span className="plan-input-wrap">
                                  <CurrencyInput
                                    value={period.investments[asset.id] || 0}
                                    showAmounts={showAmounts}
                                    readOnly={!showAmounts}
                                    allowNegative
                                    onValueChange={(value) => setBudgetAmount(category, period.id, "investment", value, asset.id)}
                                    ariaLabel={`${asset.name || "名称未設定"}への投資予算`}
                                  />
                                  <span>円</span>
                                </span>
                              </label>
                            ))}
                            </div>
                            <p className="cash-flow-preview">
                              <span>現金への毎月の反映額</span>
                              <strong>{displayedYen(period.income - period.expense - investmentTotal, showAmounts)}円</strong>
                            </p>
                          </div>
                        </details>
                      );
                    })}
                  </div>
                )}
              </section>
                );
              })}
              </div>
            </>
          ) : activeTab === "settings" ? (
            <>
              <header className="page-header">
                <div>
                  <h1>設定</h1>
                  <p>資産項目ごとの想定年利</p>
                </div>
              </header>
              <section className="settings-panel" aria-labelledby="settings-title">
                <div className="settings-heading">
                  <div>
                    <h2 id="settings-title">年利</h2>
                    <p>年利から月ごとの利回りを算出し、将来の資産予測に反映します。</p>
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
                          <span>年利</span>
                          <span className="plan-input-wrap rate">
                            <input
                              type="number"
                              min="-100"
                              step="0.1"
                              inputMode="decimal"
                              value={plan.annualRate || ""}
                              placeholder="0"
                              onChange={(event) => setPlan(asset.id, "annualRate", event.target.value)}
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
