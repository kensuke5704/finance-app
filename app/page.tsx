"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import LoginGate from "../components/LoginGate";
import {
  defaultState,
  fundNames,
  investmentAccounts,
  loadFinanceState,
  newFundRecord,
  newFxTrade,
  newInvestmentRecord,
  newMonthlyRecord,
  newTickerHolding,
  persistFinanceState,
  persistLocalFinanceState,
} from "../lib/financeStore";
import type {
  FinanceState,
  FundRecord,
  FxRiskInput,
  FxTrade,
  InvestmentRecord,
  MonthlyRecord,
  TickerHolding,
} from "../types/finance";

type MainTab = "short" | "asset" | "budget";
type AssetInnerTab = "asset" | "fund" | "active" | "fx";

const yen = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("ja-JP", {
  style: "percent",
  maximumFractionDigits: 2,
});
const SHORT_K_ACCOUNTS = ["WealthNavi", "ROBOPRO", "INDEX", "Active"];
const SHORT_M_ACCOUNTS = ["Cash", "WealthNavi", "NASDAQ100", "NISA"];

function n(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return `${yen.format(Math.round(value))}円`;
}

function signedMoney(value: number) {
  const rounded = Math.round(value);
  const sign = rounded >= 0 ? "+" : "";
  return `${sign}${money(rounded)}`;
}

function signedRate(value: number, base: number) {
  if (!base) return "—";
  const rate = value / base;
  const sign = rate >= 0 ? "+" : "";
  return `${sign}${pct.format(rate)}`;
}

function formatMoneyInput(value: number) {
  if (!value) return "";
  return yen.format(Math.round(value));
}

function parseMoneyInput(value: string) {
  const parsed = Number(value.replace(/[^0-9-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayString() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fundEvaluation(row: FundRecord) {
  return (n(row.price) * n(row.units)) / 10000;
}

function tickerEvaluation(row: TickerHolding) {
  return n(row.price) * Math.max(1, n(row.shares));
}

function formatCount(value: number) {
  if (!value) return "0";
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 4 }).format(value);
}

function normalizeQuoteSymbol(value: string) {
  return value.trim().replace(/\s+/g, "");
}

async function fetchLatestMarketPrice(symbol: string) {
  const normalized = normalizeQuoteSymbol(symbol);
  if (!normalized) return null;

  const candidates = Array.from(new Set([normalized, normalized.toUpperCase(), `${normalized}.T`]));
  for (const candidate of candidates) {
    try {
      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(candidate)}?range=5d&interval=1d`,
      );
      if (!response.ok) continue;
      const json = await response.json();
      const result = json?.chart?.result?.[0];
      const quote = result?.indicators?.quote?.[0];
      const closes = Array.isArray(quote?.close) ? quote.close : [];
      const latest = [...closes].reverse().find((item) => Number.isFinite(Number(item)));
      if (Number.isFinite(Number(latest)) && Number(latest) > 0) {
        return Number(latest);
      }
    } catch {
      // Ignore network failures and keep the current price.
    }
  }
  return null;
}

function actualCash(row?: MonthlyRecord) {
  if (!row) return 0;
  return row.cash_actual || row.cash_prediction || 0;
}

function actualIncome(row?: MonthlyRecord) {
  if (!row) return 0;
  return row.income_actual || row.income_budget || 0;
}

function actualOutgo(row?: MonthlyRecord) {
  if (!row) return 0;
  const outgo = row.outgo_cash + row.outgo_card + row.outgo_other;
  return outgo || row.outgo_budget || 0;
}

function actualInvest(row?: MonthlyRecord) {
  if (!row) return 0;
  return row.invest_actual || row.invest_budget || 0;
}

function netAssets(row?: MonthlyRecord) {
  if (!row) return 0;
  return (
    actualCash(row) +
    actualInvest(row) +
    (row.usd_actual || row.usd_capital || 0)
  );
}

function MonthInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      className="input"
      type="month"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function NumberInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      className="input"
      type="number"
      value={value}
      onChange={(e) => onChange(n(e.target.value))}
    />
  );
}

function parsePlainNumberInput(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function FormattedNumberInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(formatCount(value));

  useEffect(() => {
    if (!focused) setDraft(formatCount(value));
  }, [value, focused]);

  return (
    <input
      className="input number-input"
      inputMode="decimal"
      value={focused ? draft : formatCount(value)}
      onFocus={() => {
        setFocused(true);
        setDraft(value ? String(value) : "");
      }}
      onBlur={() => {
        const nextValue = parsePlainNumberInput(draft);
        onChange(nextValue);
        setFocused(false);
        setDraft(formatCount(nextValue));
      }}
      onChange={(event) => setDraft(event.target.value)}
    />
  );
}

function MoneyInput({
  value,
  onChange,
  commitOnBlur = false,
}: {
  value: number;
  onChange: (value: number) => void;
  commitOnBlur?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(formatMoneyInput(value));
  const changeTimerRef = useRef<number | null>(null);
  const latestValueRef = useRef(value);

  useEffect(() => {
    latestValueRef.current = value;
    if (!focused) setDraft(formatMoneyInput(value));
  }, [value, focused]);

  useEffect(() => {
    return () => {
      if (changeTimerRef.current) window.clearTimeout(changeTimerRef.current);
    };
  }, []);

  const commit = (nextValue: number) => {
    if (changeTimerRef.current) {
      window.clearTimeout(changeTimerRef.current);
      changeTimerRef.current = null;
    }
    if (nextValue !== latestValueRef.current) {
      latestValueRef.current = nextValue;
      onChange(nextValue);
    }
  };

  const scheduleCommit = (nextValue: number) => {
    if (changeTimerRef.current) window.clearTimeout(changeTimerRef.current);
    changeTimerRef.current = window.setTimeout(() => {
      commit(nextValue);
    }, 250);
  };

  return (
    <div className="money-input-wrap">
      <input
        className="input money-input"
        inputMode="text"
        value={focused ? draft : formatMoneyInput(value)}
        placeholder="0"
        onFocus={() => {
          setFocused(true);
          setDraft(value ? String(Math.round(value)) : "");
        }}
        onBlur={() => {
          const nextValue = parseMoneyInput(draft);
          commit(nextValue);
          setFocused(false);
          setDraft(formatMoneyInput(nextValue));
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            const nextValue = parseMoneyInput(draft);
            commit(nextValue);
            event.currentTarget.blur();
          }
        }}
        onChange={(e) => {
          const next = e.target.value;
          const nextValue = parseMoneyInput(next);
          setDraft(next);
          if (!commitOnBlur) scheduleCommit(nextValue);
        }}
      />
      <span className="money-input-unit">円</span>
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className="input"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}


type ConfirmDialogConfig = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
};

function ConfirmDialog({ config, onClose }: { config: ConfirmDialogConfig | null; onClose: () => void }) {
  if (!config) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-title">{config.title}</div>
        <p className="modal-message">{config.message}</p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn"
            onClick={() => {
              config.onCancel?.();
              onClose();
            }}
          >
            {config.cancelLabel ?? "キャンセル"}
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              config.onConfirm();
              onClose();
            }}
          >
            {config.confirmLabel ?? "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}

function latestByMonth<T extends { month: string }>(rows: T[]) {
  return [...rows].sort((a, b) => b.month.localeCompare(a.month))[0];
}

function monthlyRows(rows: MonthlyRecord[]) {
  return [...rows].sort((a, b) => a.month.localeCompare(b.month));
}

function investmentValue(row: InvestmentRecord) {
  return row.actual_balance || row.predicted_balance || row.capital || 0;
}

function investmentsByAccounts(rows: InvestmentRecord[], accounts: string[]) {
  return rows.filter((row) => accounts.includes(row.account));
}

function latestInvestmentRows(rows: InvestmentRecord[]) {
  const map = new Map<string, InvestmentRecord>();
  [...rows]
    .sort((a, b) => a.month.localeCompare(b.month))
    .forEach((row) => map.set(row.account, row));
  return Array.from(map.values());
}

function totalInvestments(rows: InvestmentRecord[]) {
  return rows.reduce((sum, row) => sum + investmentValue(row), 0);
}

export default function Page() {
  const [state, setState] = useState<FinanceState>(defaultState);
  const [mainTab, setMainTab] = useState<MainTab>("short");
  const [assetInnerTab, setAssetInnerTab] = useState<AssetInnerTab>("asset");
  const [inputOpen, setInputOpen] = useState(true);
  const [selectedMonthlyId, setSelectedMonthlyId] = useState(
    defaultState.monthly[0]?.id ?? "",
  );
  const [selectedShortKMonth, setSelectedShortKMonth] = useState("");
  const [selectedInvestmentId, setSelectedInvestmentId] = useState(
    defaultState.investments[0]?.id ?? "",
  );
  const [selectedFundId, setSelectedFundId] = useState(
    defaultState.funds[0]?.id ?? "",
  );
  const [selectedTickerId, setSelectedTickerId] = useState(
    defaultState.tickers[0]?.id ?? "",
  );
  const [selectedFxId, setSelectedFxId] = useState(
    defaultState.fxTrades[0]?.id ?? "",
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadFinanceState()
      .then((loaded) => {
        setState(loaded);
        setSelectedMonthlyId(
          loaded.monthly.find((row) => inMonthRange(row.month))?.id ??
            loaded.monthly[0]?.id ??
            "",
        );
        setSelectedShortKMonth("");
        setSelectedInvestmentId(loaded.investments[0]?.id ?? "");
        setSelectedFundId(loaded.funds[0]?.id ?? "");
        setSelectedTickerId(loaded.tickers[0]?.id ?? "");
        setSelectedFxId(loaded.fxTrades[0]?.id ?? "");
      })
      .catch((error) =>
        setMessage(`データ取得に失敗しました: ${error.message}`),
      )
      .finally(() => {
        loadedRef.current = true;
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!loadedRef.current || loading) return;

    const localTimer = window.setTimeout(() => {
      try {
        persistLocalFinanceState(state);
      } catch {
        // local backup failures should not block typing
      }
    }, 250);

    const remoteTimer = window.setTimeout(() => {
      save(state, true);
    }, 2500);

    return () => {
      window.clearTimeout(localTimer);
      window.clearTimeout(remoteTimer);
    };
  }, [state, loading]);

  async function save(nextState = state, silent = false) {
    if (!silent) {
      setSaving(true);
      setMessage("");
    }
    try {
      await persistFinanceState(nextState);
      if (!silent) setMessage("保存しました");
    } catch (error) {
      if (!silent) {
        setMessage(
          `保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } finally {
      if (!silent) setSaving(false);
    }
  }

  function updateMonthly(row: MonthlyRecord) {
    setState((prev) => ({
      ...prev,
      monthly: prev.monthly.map((item) => (item.id === row.id ? row : item)),
    }));
  }
  function upsertShortKMonthly(month: string, patch: Partial<MonthlyRecord>) {
    setState((prev) => {
      const existing = prev.monthly.find((row) => row.month === month);
      if (existing) {
        return {
          ...prev,
          monthly: prev.monthly.map((row) =>
            row.id === existing.id ? { ...row, ...patch, month } : row,
          ),
        };
      }
      const row: MonthlyRecord = {
        ...newMonthlyRecord(),
        id: uid(),
        month,
        ...patch,
      };
      return { ...prev, monthly: [...prev.monthly, row] };
    });
  }
  function upsertShortKInvestment(
    month: string,
    account: string,
    patch: Partial<InvestmentRecord>,
  ) {
    setState((prev) => {
      const existing = prev.investments.find(
        (row) => row.month === month && row.account === account,
      );
      if (existing) {
        return {
          ...prev,
          investments: prev.investments.map((row) =>
            row.id === existing.id ? { ...row, ...patch, month, account } : row,
          ),
        };
      }
      const row: InvestmentRecord = {
        ...newInvestmentRecord(),
        id: uid(),
        month,
        account,
        ...patch,
      };
      return { ...prev, investments: [...prev.investments, row] };
    });
  }
  function updateInvestment(row: InvestmentRecord) {
    setState((prev) => ({
      ...prev,
      investments: prev.investments.map((item) =>
        item.id === row.id ? row : item,
      ),
    }));
  }
  function updateFund(row: FundRecord) {
    setState((prev) => ({
      ...prev,
      funds: prev.funds.map((item) => (item.id === row.id ? row : item)),
    }));
  }
  function updateTicker(row: TickerHolding) {
    setState((prev) => ({
      ...prev,
      tickers: prev.tickers.map((item) =>
        item.id === row.id ? row : item,
      ),
    }));
  }
  function updateFx(row: FxTrade) {
    setState((prev) => ({
      ...prev,
      fxTrades: prev.fxTrades.map((item) => (item.id === row.id ? row : item)),
    }));
  }
  function updateRisk(row: FxRiskInput) {
    setState((prev) => ({ ...prev, fxRisk: row }));
  }

  const selectedMonthly =
    state.monthly.find((row) => row.id === selectedMonthlyId) ??
    state.monthly[0];
  const selectedInvestment =
    state.investments.find((row) => row.id === selectedInvestmentId) ??
    state.investments[0];
  const selectedFund =
    state.funds.find((row) => row.id === selectedFundId) ?? state.funds[0];
  const selectedTicker =
    state.tickers.find((row) => row.id === selectedTickerId) ??
    state.tickers[0];
  const selectedFx =
    state.fxTrades.find((row) => row.id === selectedFxId) ?? state.fxTrades[0];

  const shortKRows = investmentsByAccounts(state.investments, SHORT_K_ACCOUNTS);
  const latestMonthly = latestByMonth(state.monthly);
  const sortedMonthly = monthlyRows(state.monthly);
  const shortKDetailRows = latestInvestmentRows(shortKRows);
  const shortKInvestmentTotal = totalInvestments(shortKDetailRows);

  const risk = state.fxRisk;
  const swap = risk.swap_per_unit * risk.holding_days * (risk.units / 10000);
  const floatingLoss =
    (risk.contract_rate - risk.current_rate) * risk.units + swap;
  const requiredMargin =
    (risk.current_rate * risk.units) / Math.max(risk.leverage, 1);
  const shortage = Math.max(
    requiredMargin -
      risk.margin -
      risk.extra_margin +
      Math.max(-floatingLoss, 0),
    0,
  );
  const losscutRate =
    risk.contract_rate -
    (risk.margin + risk.extra_margin - requiredMargin + swap) /
      Math.max(risk.units, 1);

  return (
    <LoginGate>
      <main className="page">
        <div className="shell">
          {message && <div className="notice">{message}</div>}

          <nav className="tabs bottom-tabs">
            {[
              ["short", "ホーム"],
              ["asset", "資産管理"],
              ["budget", "予算設定"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={`tab ${mainTab === key ? "active" : ""}`}
                onClick={() => setMainTab(key as MainTab)}
              >
                {label}
              </button>
            ))}
          </nav>

          {mainTab === "short" && selectedMonthly && (
            <ShortKView
              rows={state.monthly}
              sortedRows={sortedMonthly}
              selectedMonth={selectedShortKMonth}
              setSelectedMonth={setSelectedShortKMonth}
              upsertMonthly={upsertShortKMonthly}
              deleteMonthly={(id) =>
                setState((prev) => ({
                  ...prev,
                  monthly: prev.monthly.filter((row) => row.id !== id),
                }))
              }
              detailRows={state.investments}
              upsertInvestment={upsertShortKInvestment}
            />
          )}

          {mainTab === "asset" && (
            <section className="stack">
              <div className="chart-tabs asset-inner-tabs">
                {[
                  ["asset", "資産管理"],
                  ["fund", "投資信託"],
                  ["active", "アクティブ"],
                  ["fx", "FX"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={`chart-tab ${assetInnerTab === key ? "active" : ""}`}
                    onClick={() => setAssetInnerTab(key as AssetInnerTab)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {assetInnerTab === "asset" && (
                <ShortKAssetManagementView
                  rows={state.monthly}
                  detailRows={state.investments}
                  selectedMonth={selectedShortKMonth}
                  setSelectedMonth={setSelectedShortKMonth}
                  upsertInvestment={upsertShortKInvestment}
                />
              )}

              {(assetInnerTab === "fund" || assetInnerTab === "active") && selectedFund && selectedTicker && (
                <MomentumView
                  title={assetInnerTab === "fund" ? "投資信託" : "アクティブ"}
                  state={state}
                  selectedFund={selectedFund}
                  selectedTicker={selectedTicker}
                  selectedFundId={selectedFundId}
                  selectedTickerId={selectedTickerId}
                  setSelectedFundId={setSelectedFundId}
                  setSelectedTickerId={setSelectedTickerId}
                  updateFund={updateFund}
                  updateTicker={updateTicker}
                  addFund={() => {
                    const row = { ...newFundRecord(), id: uid() };
                    setState((prev) => ({ ...prev, funds: [row, ...prev.funds] }));
                    setSelectedFundId(row.id);
                  }}
                  addTicker={() => {
                    const row = { ...newTickerHolding(), id: uid(), shares: 1 };
                    setState((prev) => ({
                      ...prev,
                      tickers: [row, ...prev.tickers],
                    }));
                    setSelectedTickerId(row.id);
                  }}
                  deleteFund={(id) =>
                    setState((prev) => ({
                      ...prev,
                      funds: prev.funds.filter((row) => row.id !== id),
                    }))
                  }
                  deleteTicker={(id) =>
                    setState((prev) => ({
                      ...prev,
                      tickers: prev.tickers.filter((row) => row.id !== id),
                    }))
                  }
                />
              )}

              {assetInnerTab === "fx" && selectedFx && (
                <FxView
                  rows={state.fxTrades}
                  selectedFx={selectedFx}
                  selectedFxId={selectedFxId}
                  setSelectedFxId={setSelectedFxId}
                  updateFx={updateFx}
                  addFx={(patch) => {
                    const row = { ...newFxTrade(), id: uid(), date: todayString(), ...patch };
                    setState((prev) => ({
                      ...prev,
                      fxTrades: [row, ...prev.fxTrades],
                    }));
                    setSelectedFxId(row.id);
                  }}
                  deleteFx={(id) =>
                    setState((prev) => ({
                      ...prev,
                      fxTrades: prev.fxTrades.filter((row) => row.id !== id),
                    }))
                  }
                  risk={risk}
                  updateRisk={updateRisk}
                  floatingLoss={floatingLoss}
                  requiredMargin={requiredMargin}
                  shortage={shortage}
                  losscutRate={losscutRate}
                />
              )}
            </section>
          )}

          {mainTab === "budget" && (
            <BudgetSettingsView
              rows={state.monthly}
              selectedMonth={selectedShortKMonth}
              setSelectedMonth={setSelectedShortKMonth}
              upsertMonthly={upsertShortKMonthly}
            />
          )}

        </div>
      </main>
    </LoginGate>
  );
}

const SHORT_K_START = "2024-09";
const SHORT_K_END = "2060-12";
const SHORT_K_BUDGET_FALLBACK_MONTH = "2031-06";
const SHORT_K_BASE_MONTH = "2024-08";
const SHORT_K_BASE_CASH = 2359881;
const SHORT_K_INITIAL_INVESTMENT_PROFIT = 5371418;
const SHORT_K_CHART_TAB_STORAGE_KEY = "finance.shortK.chartTab";
const SHORT_K_MONTHLY_OPEN_YEARS_STORAGE_KEY = "finance.shortK.monthlyOpenYears";

function readLocalStorage(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage failures
  }
}

type ShortKBudget = {
  cashPrediction: number;
  incomeCashBudget: number;
  incomeInvestmentBudget: number;
  outgoBudget: number;
  fundInvestmentBudget: number;
  activeInvestmentBudget: number;
  usdInvestmentBudget: number;
};

type ShortKActuals = {
  incomeCash: number;
  incomeInvestment: number;
  outgoCash: number;
  outgoPaypay: number;
  outgoCard: number;
  fundInvestment: number;
  activeInvestment: number;
  usdInvestment: number;
};

const emptyShortKActuals: ShortKActuals = {
  incomeCash: 0,
  incomeInvestment: 0,
  outgoCash: 0,
  outgoPaypay: 0,
  outgoCard: 0,
  fundInvestment: 0,
  activeInvestment: 0,
  usdInvestment: 0,
};

const SHORT_K_BUDGETS: Record<string, ShortKBudget> = {
  "2024-09": {
    cashPrediction: 1479881,
    incomeCashBudget: 1100000,
    incomeInvestmentBudget: 0,
    outgoBudget: 100000,
    fundInvestmentBudget: 0,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2024-10": {
    cashPrediction: 3305980,
    incomeCashBudget: 0,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 0,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2024-11": {
    cashPrediction: 2004077,
    incomeCashBudget: 30000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 0,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2024-12": {
    cashPrediction: 778193,
    incomeCashBudget: 30000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 0,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2025-01": {
    cashPrediction: 1949043,
    incomeCashBudget: 30000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 1300000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2025-02": {
    cashPrediction: 1508459,
    incomeCashBudget: 30000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2025-03": {
    cashPrediction: 1013403,
    incomeCashBudget: 30000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2025-04": {
    cashPrediction: 840982,
    incomeCashBudget: 30000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2025-05": {
    cashPrediction: 340113,
    incomeCashBudget: 40000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 100,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2025-06": {
    cashPrediction: 322719,
    incomeCashBudget: 40000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 100,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2025-07": {
    cashPrediction: 235285,
    incomeCashBudget: 40000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 100,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2025-08": {
    cashPrediction: 631536,
    incomeCashBudget: 40000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 100,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2025-09": {
    cashPrediction: 1276532,
    incomeCashBudget: 1140000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 100000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2025-10": {
    cashPrediction: 1171825,
    incomeCashBudget: 40000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 100000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2025-11": {
    cashPrediction: 1774078,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 50000,
    outgoBudget: 90000,
    fundInvestmentBudget: 0,
    activeInvestmentBudget: 100000,
    usdInvestmentBudget: 0,
  },
  "2025-12": {
    cashPrediction: 1756392,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 50000,
    outgoBudget: 90000,
    fundInvestmentBudget: 0,
    activeInvestmentBudget: 100000,
    usdInvestmentBudget: 0,
  },
  "2026-01": {
    cashPrediction: 1460291,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 50000,
    outgoBudget: 90000,
    fundInvestmentBudget: 150000,
    activeInvestmentBudget: 150000,
    usdInvestmentBudget: 0,
  },
  "2026-02": {
    cashPrediction: 495030,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 50000,
    outgoBudget: 90000,
    fundInvestmentBudget: 60000,
    activeInvestmentBudget: 30000,
    usdInvestmentBudget: 1000000,
  },
  "2026-03": {
    cashPrediction: 271789,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 50000,
    outgoBudget: 90000,
    fundInvestmentBudget: -466412,
    activeInvestmentBudget: -198203,
    usdInvestmentBudget: 800000,
  },
  "2026-04": {
    cashPrediction: 1119583,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 50000,
    outgoBudget: 90000,
    fundInvestmentBudget: -799800,
    activeInvestmentBudget: 200,
    usdInvestmentBudget: 0,
  },
  "2026-05": {
    cashPrediction: 1077241,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 50000,
    outgoBudget: 90000,
    fundInvestmentBudget: 100,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2026-06": {
    cashPrediction: 339376,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 50000,
    outgoBudget: 90000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 1500000,
    usdInvestmentBudget: -800000,
  },
  "2026-07": {
    cashPrediction: 362475,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 300000,
    outgoBudget: 90000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2026-08": {
    cashPrediction: 272475,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 0,
    outgoBudget: 90000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2026-09": {
    cashPrediction: 782475,
    incomeCashBudget: 1150000,
    incomeInvestmentBudget: 0,
    outgoBudget: 90000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 500000,
    usdInvestmentBudget: 0,
  },
  "2026-10": {
    cashPrediction: 692475,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 0,
    outgoBudget: 90000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2026-11": {
    cashPrediction: 602475,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 0,
    outgoBudget: 90000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2026-12": {
    cashPrediction: 102475,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 0,
    outgoBudget: 500000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2027-01": {
    cashPrediction: 12475,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 0,
    outgoBudget: 90000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2027-02": {
    cashPrediction: -77525,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 0,
    outgoBudget: 90000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2027-03": {
    cashPrediction: -167525,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 0,
    outgoBudget: 90000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2027-04": {
    cashPrediction: -337525,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 300000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2027-05": {
    cashPrediction: -387525,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2027-06": {
    cashPrediction: -437525,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2027-07": {
    cashPrediction: -182634,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 304891,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2027-08": {
    cashPrediction: -232634,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2027-09": {
    cashPrediction: -182634,
    incomeCashBudget: 1280000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 1000000,
    usdInvestmentBudget: 0,
  },
  "2027-10": {
    cashPrediction: -232634,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2027-11": {
    cashPrediction: -282634,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2027-12": {
    cashPrediction: -332634,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2028-01": {
    cashPrediction: 409846,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 1000000,
    usdInvestmentBudget: -1792480,
  },
  "2028-02": {
    cashPrediction: 359846,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2028-03": {
    cashPrediction: 309846,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2028-04": {
    cashPrediction: 259846,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2028-05": {
    cashPrediction: 209846,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2028-06": {
    cashPrediction: 159846,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2028-07": {
    cashPrediction: 607840,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 497995,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2028-08": {
    cashPrediction: 557840,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2028-09": {
    cashPrediction: 607840,
    incomeCashBudget: 1280000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 1000000,
    usdInvestmentBudget: 0,
  },
  "2028-10": {
    cashPrediction: 557840,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2028-11": {
    cashPrediction: 507840,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2028-12": {
    cashPrediction: 457840,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-01": {
    cashPrediction: 407840,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-02": {
    cashPrediction: 357840,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-03": {
    cashPrediction: 307840,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-04": {
    cashPrediction: 277840,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-05": {
    cashPrediction: 247840,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-06": {
    cashPrediction: 217840,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-07": {
    cashPrediction: 881316,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 693476,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-08": {
    cashPrediction: 851316,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-09": {
    cashPrediction: 1921316,
    incomeCashBudget: 1300000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-10": {
    cashPrediction: 1891316,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-11": {
    cashPrediction: 1861316,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-12": {
    cashPrediction: 1831316,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-01": {
    cashPrediction: 1756316,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-02": {
    cashPrediction: 1681316,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-03": {
    cashPrediction: 1606316,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-04": {
    cashPrediction: 1531316,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-05": {
    cashPrediction: 1456316,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-06": {
    cashPrediction: 1381316,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-07": {
    cashPrediction: 2185306,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 878990,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-08": {
    cashPrediction: 2110306,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-09": {
    cashPrediction: 3135306,
    incomeCashBudget: 1300000,
    incomeInvestmentBudget: 0,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-10": {
    cashPrediction: 3060306,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-11": {
    cashPrediction: 2985306,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-12": {
    cashPrediction: 2910306,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2031-01": {
    cashPrediction: 305306,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 2755000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2031-02": {
    cashPrediction: 200306,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 255000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2031-03": {
    cashPrediction: 95306,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 255000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2031-04": {
    cashPrediction: -9694,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 255000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2031-05": {
    cashPrediction: -114694,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 255000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2031-06": {
    cashPrediction: -219694,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 255000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
};

function currentMonthString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function inMonthRange(month: string, start = SHORT_K_START, end = SHORT_K_END) {
  return month >= start && month <= end;
}

function displayMonth(month: string) {
  const [year, monthNumber] = month.split("-");
  return `${year}/${Number(monthNumber)}`;
}

function monthsBetween(start: string, end: string) {
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  const months: string[] = [];
  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

function blankMonthly(month: string): MonthlyRecord {
  return { ...newMonthlyRecord(), id: `draft-${month}`, month };
}

function monthlyForMonth(rows: MonthlyRecord[], month: string) {
  return rows.find((row) => row.month === month) ?? blankMonthly(month);
}

function previousMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseShortKBudgetOverrides(
  row?: MonthlyRecord,
): Partial<ShortKBudget> {
  if (!row?.note) return {};
  try {
    const parsed = JSON.parse(row.note);
    const values = parsed?.shortKBudgetOverrides;
    if (!values || typeof values !== "object") return {};

    const overrides: Partial<ShortKBudget> = {};
    const keys: (keyof ShortKBudget)[] = [
      "cashPrediction",
      "incomeCashBudget",
      "incomeInvestmentBudget",
      "outgoBudget",
      "fundInvestmentBudget",
      "activeInvestmentBudget",
      "usdInvestmentBudget",
    ];

    keys.forEach((key) => {
      if (values[key] !== undefined && values[key] !== null && values[key] !== "") {
        overrides[key] = n(values[key]);
      }
    });

    return overrides;
  } catch {
    return {};
  }
}

function shortKBudget(month: string, row?: MonthlyRecord): ShortKBudget {
  const fallback = SHORT_K_BUDGETS[SHORT_K_BUDGET_FALLBACK_MONTH];
  const base = SHORT_K_BUDGETS[month] ?? {
    ...fallback,
    cashPrediction: row?.cash_prediction ?? fallback.cashPrediction,
    incomeCashBudget: row?.income_budget ?? fallback.incomeCashBudget,
    outgoBudget: row?.outgo_budget ?? fallback.outgoBudget,
    fundInvestmentBudget: row?.invest_budget ?? fallback.fundInvestmentBudget,
  };

  return { ...base, ...parseShortKBudgetOverrides(row) };
}

function parseShortKActuals(row?: MonthlyRecord): ShortKActuals {
  if (!row?.note) return { ...emptyShortKActuals };
  try {
    const parsed = JSON.parse(row.note);
    const values = parsed?.shortKActuals ?? parsed;
    return {
      incomeCash: n(values.incomeCash),
      incomeInvestment: n(values.incomeInvestment),
      outgoCash: n(values.outgoCash),
      outgoPaypay: n(values.outgoPaypay),
      outgoCard: n(values.outgoCard),
      fundInvestment: n(values.fundInvestment),
      activeInvestment: n(values.activeInvestment),
      usdInvestment: n(values.usdInvestment),
    };
  } catch {
    return { ...emptyShortKActuals };
  }
}

function buildShortKNote(
  row: MonthlyRecord | undefined,
  actuals: ShortKActuals,
  budgetOverrides?: Partial<ShortKBudget>,
) {
  let base: Record<string, unknown> = {};
  if (row?.note) {
    try {
      const parsed = JSON.parse(row.note);
      if (parsed && typeof parsed === "object") base = parsed;
    } catch {
      base = {};
    }
  }
  const existingBudgetOverrides = parseShortKBudgetOverrides(row);
  return JSON.stringify({
    ...base,
    shortKActuals: actuals,
    shortKBudgetOverrides: {
      ...existingBudgetOverrides,
      ...(budgetOverrides ?? {}),
    },
  });
}

function hasShortKActuals(actuals: ShortKActuals) {
  return Object.values(actuals).some((value) => value !== 0);
}

function shortKIncomeTotal(actuals: ShortKActuals) {
  return actuals.incomeCash + actuals.incomeInvestment;
}

function shortKOutgoTotal(
  actuals: ShortKActuals,
  previousActuals?: ShortKActuals,
) {
  return (
    actuals.outgoCash + actuals.outgoPaypay + (previousActuals?.outgoCard ?? 0)
  );
}

function shortKInvestmentTotal(actuals: ShortKActuals) {
  return (
    actuals.fundInvestment + actuals.activeInvestment + actuals.usdInvestment
  );
}

function shortKBudgetIncomeTotal(budget: ShortKBudget) {
  return budget.incomeCashBudget + budget.incomeInvestmentBudget;
}

function shortKBudgetInvestmentTotal(budget: ShortKBudget) {
  return (
    budget.fundInvestmentBudget +
    budget.activeInvestmentBudget +
    budget.usdInvestmentBudget
  );
}

function shortKBudgetDelta(month: string, row?: MonthlyRecord) {
  const budget = shortKBudget(month, row);
  return (
    shortKBudgetIncomeTotal(budget) -
    budget.outgoBudget -
    shortKBudgetInvestmentTotal(budget)
  );
}

function shortKActualDelta(
  actuals: ShortKActuals,
  previousActuals?: ShortKActuals,
) {
  return (
    shortKIncomeTotal(actuals) -
    shortKOutgoTotal(actuals, previousActuals) -
    shortKInvestmentTotal(actuals)
  );
}

function shortKCalculatedDeposit(month: string, rows: MonthlyRecord[]): number {
  let balance = SHORT_K_BASE_CASH;
  const months = monthsBetween(SHORT_K_START, month);

  for (const currentMonth of months) {
    const row = rows.find((item) => item.month === currentMonth);
    const actuals = parseShortKActuals(row);
    const previousRow = rows.find(
      (item) => item.month === previousMonth(currentMonth),
    );
    const previousActuals = parseShortKActuals(previousRow);

    balance +=
      row && hasShortKActuals(actuals)
        ? shortKActualDelta(actuals, previousActuals)
        : shortKBudgetDelta(currentMonth, row);
  }

  return balance;
}

function canCalculateShortKDeposit(month: string, rows: MonthlyRecord[]) {
  if (month === SHORT_K_START) return true;
  const previous = rows.find((row) => row.month === previousMonth(month));
  return Boolean(previous && isShortKEntered(previous));
}

function actualAccount(row: MonthlyRecord) {
  const actuals = parseShortKActuals(row);
  return shortKInvestmentTotal(actuals);
}

function predictedAccount(row: MonthlyRecord, detailRows: InvestmentRecord[]) {
  const investmentPrediction = SHORT_K_ACCOUNTS.reduce((sum, account) => {
    const investment = detailRows.find(
      (item) => item.month === row.month && item.account === account,
    );
    return sum + (investment?.predicted_balance ?? 0);
  }, 0);
  return investmentPrediction + row.usd_capital;
}

function isShortKEntered(row: MonthlyRecord) {
  return hasShortKActuals(parseShortKActuals(row));
}

function latestEnteredShortKMonth(rows: MonthlyRecord[]) {
  const entered = rows
    .filter((row) => inMonthRange(row.month) && isShortKEntered(row))
    .map((row) => row.month)
    .sort();
  return entered.at(-1);
}

function shortKProjectedBalance(
  month: string,
  rows: MonthlyRecord[],
  latestEnteredMonth?: string,
) {
  const startBalance = latestEnteredMonth
    ? shortKCalculatedDeposit(latestEnteredMonth, rows)
    : SHORT_K_BASE_CASH;
  const startMonth = latestEnteredMonth
    ? nextMonth(latestEnteredMonth)
    : SHORT_K_START;

  let balance = startBalance;
  for (const currentMonth of monthsBetween(startMonth, month)) {
    const row = rows.find((item) => item.month === currentMonth);
    balance += shortKBudgetDelta(currentMonth, row);
  }
  return balance;
}

function nextMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}


type ShortKAssetAccountKey = "fund" | "active" | "usd";

const SHORT_K_ASSET_ACCOUNTS: Record<
  ShortKAssetAccountKey,
  {
    label: string;
    account: string;
    actualKey: keyof ShortKActuals;
    budgetKey: keyof Pick<
      ShortKBudget,
      "fundInvestmentBudget" | "activeInvestmentBudget" | "usdInvestmentBudget"
    >;
    annualRate: number;
  }
> = {
  fund: {
    label: "投資信託口座",
    account: "投資信託口座",
    actualKey: "fundInvestment",
    budgetKey: "fundInvestmentBudget",
    annualRate: 0.15,
  },
  active: {
    label: "アクティブ口座",
    account: "アクティブ口座",
    actualKey: "activeInvestment",
    budgetKey: "activeInvestmentBudget",
    annualRate: 0.18,
  },
  usd: {
    label: "FX口座",
    account: "FX口座",
    actualKey: "usdInvestment",
    budgetKey: "usdInvestmentBudget",
    annualRate: 0.1,
  },
};

function shortKAssetAccountAliases(account: string) {
  return account === "FX口座" ? ["FX口座", "USD口座"] : [account];
}

function shortKAssetRowMatches(row: InvestmentRecord, account: string) {
  return shortKAssetAccountAliases(account).includes(row.account);
}

function getShortKAssetRows(rows: InvestmentRecord[], month: string) {
  const accounts = Object.values(SHORT_K_ASSET_ACCOUNTS).flatMap(
    (config) => shortKAssetAccountAliases(config.account),
  );
  return rows.filter((row) => row.month === month && accounts.includes(row.account));
}

function shortKAccountPrincipal(
  accountKey: ShortKAssetAccountKey,
  month: string,
  rows: MonthlyRecord[],
  detailRows: InvestmentRecord[] = [],
) {
  if (!month || month <= SHORT_K_BASE_MONTH) return 0;
  const config = SHORT_K_ASSET_ACCOUNTS[accountKey];
  let principal = 0;
  let previousValue = 0;

  for (const currentMonth of monthsBetween(SHORT_K_START, month)) {
    const row = rows.find((item) => item.month === currentMonth);
    const actuals = parseShortKActuals(row);
    const budget = shortKBudget(currentMonth, row);
    const deposit = row && hasShortKActuals(actuals)
      ? actuals[config.actualKey]
      : n(budget[config.budgetKey]);

    if (deposit >= 0) {
      principal += deposit;
    } else {
      const withdrawal = Math.abs(deposit);
      const basisValue = Math.max(previousValue, principal);
      const principalRatio = basisValue > 0 ? Math.min(1, Math.max(0, principal / basisValue)) : 1;
      principal = Math.max(0, principal - withdrawal * principalRatio);
    }

    const enteredValue = shortKAccountEvaluation(accountKey, currentMonth, detailRows);
    if (enteredValue) {
      previousValue = enteredValue;
    } else {
      const baseValue = previousValue || principal;
      previousValue = baseValue * (1 + shortKAccountMonthlyRate(accountKey)) + Math.max(deposit, 0);
    }
  }

  return principal;
}

function shortKAccountMonthlyRate(accountKey: ShortKAssetAccountKey) {
  return Math.pow(1 + SHORT_K_ASSET_ACCOUNTS[accountKey].annualRate, 1 / 12) - 1;
}

function shortKAccountDepositForMonth(
  accountKey: ShortKAssetAccountKey,
  month: string,
  rows: MonthlyRecord[],
) {
  const config = SHORT_K_ASSET_ACCOUNTS[accountKey];
  const row = rows.find((item) => item.month === month);
  const actuals = parseShortKActuals(row);
  const budget = shortKBudget(month, row);
  return row && hasShortKActuals(actuals)
    ? actuals[config.actualKey]
    : n(budget[config.budgetKey]);
}

function shortKAccountEvaluation(
  accountKey: ShortKAssetAccountKey,
  month: string,
  detailRows: InvestmentRecord[],
) {
  const account = SHORT_K_ASSET_ACCOUNTS[accountKey].account;
  const row = detailRows.find(
    (item) => item.month === month && shortKAssetRowMatches(item, account),
  );
  return row?.actual_balance || 0;
}

function shortKAccountPredictedValue(
  accountKey: ShortKAssetAccountKey,
  month: string,
  rows: MonthlyRecord[],
  detailRows: InvestmentRecord[],
) {
  if (!month || month <= SHORT_K_BASE_MONTH) return 0;

  let previousValue = 0;
  for (const currentMonth of monthsBetween(SHORT_K_START, month)) {
    const enteredValue = shortKAccountEvaluation(
      accountKey,
      currentMonth,
      detailRows,
    );
    const baseValue = enteredValue || previousValue;
    const deposit = shortKAccountDepositForMonth(accountKey, currentMonth, rows);
    const predictedValue = baseValue * (1 + shortKAccountMonthlyRate(accountKey)) + deposit;
    previousValue = enteredValue || predictedValue;
  }

  return previousValue;
}

function shortKAssetSummary(
  month: string,
  rows: MonthlyRecord[],
  detailRows: InvestmentRecord[],
) {
  return (Object.keys(SHORT_K_ASSET_ACCOUNTS) as ShortKAssetAccountKey[]).reduce(
    (summary, key) => {
      const principal = shortKAccountPrincipal(key, month, rows, detailRows);
      const evaluation = shortKAccountEvaluation(key, month, detailRows);
      const predicted = shortKAccountPredictedValue(key, month, rows, detailRows);
      const value = evaluation || predicted;
      return {
        principal: summary.principal + principal,
        value: summary.value + value,
        profit: summary.profit + value - principal,
      };
    },
    { principal: 0, value: 0, profit: 0 },
  );
}

function shortKAssetActualSummary(
  month: string,
  rows: MonthlyRecord[],
  detailRows: InvestmentRecord[],
) {
  return (Object.keys(SHORT_K_ASSET_ACCOUNTS) as ShortKAssetAccountKey[]).reduce(
    (summary, key) => {
      const principal = shortKAccountPrincipal(key, month, rows, detailRows);
      const evaluation = shortKAccountEvaluation(key, month, detailRows);
      return {
        principal: summary.principal + principal,
        value: summary.value + evaluation,
        profit: summary.profit + (principal > 0 ? evaluation - principal : 0),
        hasEvaluation: summary.hasEvaluation || evaluation !== 0,
      };
    },
    { principal: 0, value: 0, profit: 0, hasEvaluation: false },
  );
}

function shortKInvestmentIncomeCumulative(
  month: string,
  rows: MonthlyRecord[],
  useBudgetForFuture = false,
) {
  return monthsBetween(SHORT_K_START, month).reduce((sum, currentMonth) => {
    const row = rows.find((item) => item.month === currentMonth);
    const actuals = parseShortKActuals(row);
    if (row && hasShortKActuals(actuals)) {
      return sum + actuals.incomeInvestment;
    }
    if (useBudgetForFuture) {
      return sum + shortKBudget(currentMonth, row).incomeInvestmentBudget;
    }
    return sum;
  }, 0);
}

function shortKTotalInvestmentProfit(
  month: string,
  rows: MonthlyRecord[],
  detailRows: InvestmentRecord[],
) {
  const summary = shortKAssetActualSummary(month, rows, detailRows);
  return summary.hasEvaluation
    ? summary.value - summary.principal - SHORT_K_INITIAL_INVESTMENT_PROFIT +
      shortKInvestmentIncomeCumulative(month, rows)
    : undefined;
}

function shortKAdjustedAssetSummary(
  month: string,
  rows: MonthlyRecord[],
  detailRows: InvestmentRecord[],
) {
  const summary = shortKAssetSummary(month, rows, detailRows);
  return {
    ...summary,
    profit: summary.value > 0
      ? summary.profit - SHORT_K_INITIAL_INVESTMENT_PROFIT +
        shortKInvestmentIncomeCumulative(month, rows, true)
      : 0,
  };
}

function buildShortKPredictionSeries(sortedRows: MonthlyRecord[], detailRows: InvestmentRecord[]) {
  const allMonths = monthsBetween(SHORT_K_START, SHORT_K_END);
  const rowByMonth = new Map(sortedRows.map((row) => [row.month, row]));
  const evaluationByKey = new Map<string, number>();

  detailRows.forEach((row) => {
    (Object.keys(SHORT_K_ASSET_ACCOUNTS) as ShortKAssetAccountKey[]).forEach((key) => {
      if (shortKAssetRowMatches(row, SHORT_K_ASSET_ACCOUNTS[key].account)) {
        evaluationByKey.set(`${key}:${row.month}`, row.actual_balance || 0);
      }
    });
  });

  const latestEnteredMonth = [...sortedRows]
    .filter((row) => inMonthRange(row.month) && isShortKEntered(row))
    .map((row) => row.month)
    .sort()
    .at(-1);

  let cashBalance = SHORT_K_BASE_CASH;
  let projectedBalance = SHORT_K_BASE_CASH;
  let latestEnteredCashBalance: number | undefined;
  let cumulativeInvestmentIncome = 0;
  let cumulativeInvestmentIncomeWithBudget = 0;

  const accountStates: Record<ShortKAssetAccountKey, { principal: number; previousValue: number }> = {
    fund: { principal: 0, previousValue: 0 },
    active: { principal: 0, previousValue: 0 },
    usd: { principal: 0, previousValue: 0 },
  };

  const rawRows = allMonths.map((month) => {
    const row = rowByMonth.get(month);
    const actuals = parseShortKActuals(row);
    const isEntered = Boolean(row && hasShortKActuals(actuals));
    const previousRow = rowByMonth.get(previousMonth(month));
    const previousActuals = parseShortKActuals(previousRow);

    cashBalance += isEntered
      ? shortKActualDelta(actuals, previousActuals)
      : shortKBudgetDelta(month, row);

    if (month === latestEnteredMonth) {
      latestEnteredCashBalance = cashBalance;
      projectedBalance = cashBalance;
    } else if (!latestEnteredMonth || month > latestEnteredMonth) {
      projectedBalance += shortKBudgetDelta(month, row);
    }

    if (isEntered) {
      cumulativeInvestmentIncome += actuals.incomeInvestment;
      cumulativeInvestmentIncomeWithBudget += actuals.incomeInvestment;
    } else {
      cumulativeInvestmentIncomeWithBudget += shortKBudget(month, row).incomeInvestmentBudget;
    }

    let actualPrincipal = 0;
    let actualValue = 0;
    let actualProfit = 0;
    let hasEvaluation = false;
    let summaryPrincipal = 0;
    let summaryValue = 0;
    let summaryProfit = 0;

    (Object.keys(SHORT_K_ASSET_ACCOUNTS) as ShortKAssetAccountKey[]).forEach((key) => {
      const state = accountStates[key];
      const config = SHORT_K_ASSET_ACCOUNTS[key];
      const budget = shortKBudget(month, row);
      const deposit = isEntered ? actuals[config.actualKey] : n(budget[config.budgetKey]);

      if (deposit >= 0) {
        state.principal += deposit;
      } else {
        const withdrawal = Math.abs(deposit);
        const basisValue = Math.max(state.previousValue, state.principal);
        const principalRatio = basisValue > 0 ? Math.min(1, Math.max(0, state.principal / basisValue)) : 1;
        state.principal = Math.max(0, state.principal - withdrawal * principalRatio);
      }

      const evaluation = evaluationByKey.get(`${key}:${month}`) ?? 0;
      const baseValue = evaluation || state.previousValue;
      const predicted = baseValue * (1 + shortKAccountMonthlyRate(key)) + deposit;
      state.previousValue = evaluation || predicted;

      actualPrincipal += state.principal;
      actualValue += evaluation;
      actualProfit += state.principal > 0 ? evaluation - state.principal : 0;
      hasEvaluation = hasEvaluation || evaluation !== 0;

      const value = evaluation || state.previousValue;
      summaryPrincipal += state.principal;
      summaryValue += value;
      summaryProfit += value - state.principal;
    });

    const totalActualProfit = hasEvaluation
      ? actualValue - actualPrincipal - SHORT_K_INITIAL_INVESTMENT_PROFIT + cumulativeInvestmentIncome
      : undefined;
    const adjustedProfit = summaryValue > 0
      ? summaryProfit - SHORT_K_INITIAL_INVESTMENT_PROFIT + cumulativeInvestmentIncomeWithBudget
      : 0;

    return {
      label: month,
      cashActual: isEntered ? cashBalance : undefined,
      cashPrediction: latestEnteredMonth
        ? month === latestEnteredMonth
          ? latestEnteredCashBalance
          : month > latestEnteredMonth
            ? projectedBalance
            : undefined
        : projectedBalance,
      assetActual: isEntered ? cashBalance + summaryValue : undefined,
      assetPrediction: (latestEnteredMonth ? month >= latestEnteredMonth : true)
        ? projectedBalance + summaryValue
        : undefined,
      cumulativeProfitActual: hasEvaluation ? totalActualProfit : undefined,
      cumulativeProfitPrediction: undefined as number | undefined,
      __hasEvaluation: hasEvaluation,
      __adjustedProfit: adjustedProfit,
    };
  });

  const latestProfit = [...rawRows]
    .reverse()
    .find((row) => row.__hasEvaluation && row.cumulativeProfitActual !== undefined);
  const latestProjectedBase = latestProfit?.__adjustedProfit ?? 0;
  const latestProfitValue = latestProfit?.cumulativeProfitActual;
  const latestProfitMonth = latestProfit?.label;

  return rawRows.map((row) => {
    const cumulativeProfitPrediction = latestProfitMonth && latestProfitValue !== undefined
      ? row.label >= latestProfitMonth
        ? latestProfitValue + (row.__adjustedProfit - latestProjectedBase)
        : undefined
      : row.__adjustedProfit !== 0
        ? row.__adjustedProfit
        : undefined;

    const { __hasEvaluation, __adjustedProfit, ...publicRow } = row;
    return { ...publicRow, cumulativeProfitPrediction };
  });
}

function shortKYearOptions() {
  const [startYear] = SHORT_K_START.split("-").map(Number);
  const [endYear] = SHORT_K_END.split("-").map(Number);
  return Array.from({ length: endYear - startYear + 1 }, (_, index) =>
    String(startYear + index),
  );
}

function shortKMonthOptions(year: string) {
  if (!year) return [];
  return Array.from({ length: 12 }, (_, index) =>
    String(index + 1).padStart(2, "0"),
  ).filter((month) => {
    const value = `${year}-${month}`;
    return inMonthRange(value);
  });
}

function ShortKInputSection({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="short-k-input-section">
      <button className="short-k-input-section-head" onClick={onToggle}>
        <span>
          {open ? "▼" : "▶"} {title}
        </span>
        {summary && <span className="section-head-summary">{summary}</span>}
      </button>
      {open && <div className="short-k-input-section-body">{children}</div>}
    </div>
  );
}

function BudgetActualRow({
  label,
  budget,
  actual,
  onChange,
  onBudgetChange,
}: {
  label: string;
  budget: number | null;
  actual: number;
  onChange: (value: number) => void;
  onBudgetChange?: (value: number) => void;
}) {
  return (
    <div className="budget-actual-card">
      <div className="budget-actual-label">{label}</div>
      <div className={`budget-actual-two-col ${budget === null ? "actual-only" : ""}`}>
        {budget !== null && (
          <div className="readonly-box">
            <span className="mini-label">予算</span>
            <b>{money(budget)}</b>
          </div>
        )}
        <label className="actual-input-box">
          <span className="mini-label">実績</span>
          <MoneyInput value={actual} onChange={onChange} commitOnBlur />
        </label>
      </div>
    </div>
  );
}

const MemoBudgetActualRow = memo(BudgetActualRow);

function BudgetActualSummary({
  label,
  budget,
  actual,
  emphasis = false,
  compact = false,
  onBudgetChange,
}: {
  label: string;
  budget: number;
  actual: number;
  emphasis?: boolean;
  compact?: boolean;
  onBudgetChange?: (value: number) => void;
}) {
  return (
    <div
      className={`budget-summary-card ${emphasis ? "emphasis" : ""} ${compact ? "compact" : ""}`}
    >
      <div className="budget-actual-label">{label}</div>
      <div className="budget-actual-two-col">
        <div className="readonly-box">
          <span className="mini-label">予算</span>
          <b>{money(budget)}</b>
        </div>
        <div className="readonly-box actual-result-box">
          <span className="mini-label">実績</span>
          <b>{money(actual)}</b>
        </div>
      </div>
    </div>
  );
}

const MemoBudgetActualSummary = memo(BudgetActualSummary);

function BudgetVarianceCard({ value }: { value: number | null }) {
  return (
    <div className="result-card">
      <span>対予算</span>
      {value === null ? (
        <b className="muted-value">&nbsp;</b>
      ) : (
        <b className={value < 0 ? "negative" : "positive"}>
          {signedMoney(value)}
        </b>
      )}
    </div>
  );
}

function ShortKView({
  rows,
  sortedRows,
  selectedMonth,
  setSelectedMonth,
  upsertMonthly,
  deleteMonthly,
  detailRows,
  upsertInvestment,
}: {
  rows: MonthlyRecord[];
  sortedRows: MonthlyRecord[];
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  upsertMonthly: (month: string, patch: Partial<MonthlyRecord>) => void;
  deleteMonthly: (id: string) => void;
  detailRows: InvestmentRecord[];
  upsertInvestment: (
    month: string,
    account: string,
    patch: Partial<InvestmentRecord>,
  ) => void;
}) {
  const [selectedYear, setSelectedYear] = useState(
    selectedMonth ? selectedMonth.slice(0, 4) : "",
  );
  const [selectedMonthNumber, setSelectedMonthNumber] = useState(
    selectedMonth ? selectedMonth.slice(5, 7) : "",
  );
  const [openInputSections, setOpenInputSections] = useState({
    income: false,
    outgo: false,
    investment: false,
  });
  const [shortKChartTab, setShortKChartTab] = useState<"cash" | "profit">("cash");

  useEffect(() => {
    setSelectedYear(selectedMonth ? selectedMonth.slice(0, 4) : "");
    setSelectedMonthNumber(selectedMonth ? selectedMonth.slice(5, 7) : "");
  }, [selectedMonth]);

  useEffect(() => {
    const savedTab = readLocalStorage(SHORT_K_CHART_TAB_STORAGE_KEY);
    if (savedTab === "cash" || savedTab === "profit") {
      setShortKChartTab(savedTab);
    }
  }, []);

  useEffect(() => {
    writeLocalStorage(SHORT_K_CHART_TAB_STORAGE_KEY, shortKChartTab);
  }, [shortKChartTab]);

  const selectedMonthKey =
    selectedYear && selectedMonthNumber
      ? `${selectedYear}-${selectedMonthNumber}`
      : "";
  const selectedMonthly = selectedMonthKey
    ? monthlyForMonth(rows, selectedMonthKey)
    : undefined;
  const enteredRows = useMemo(
    () => sortedRows.filter((row) => inMonthRange(row.month) && isShortKEntered(row)),
    [sortedRows],
  );
  const rowsById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const handleMonthlySelect = useCallback((id: string) => {
    const row = rowsById.get(id);
    if (row) setSelectedMonth(row.month);
  }, [rowsById, setSelectedMonth]);
  const handleMonthlyDelete = useCallback((id: string) => {
    deleteMonthly(id);
  }, [deleteMonthly]);
  const deferredSortedRows = useDeferredValue(sortedRows);
  const deferredDetailRows = useDeferredValue(detailRows);
  const shortKSeries = useMemo(
    () => buildShortKPredictionSeries(deferredSortedRows, deferredDetailRows),
    [deferredSortedRows, deferredDetailRows],
  );
  const latestShortKSnapshot = useMemo(() => {
    const latestCashActual = [...shortKSeries].reverse().find((row) => typeof row.cashActual === "number");
    const latestAssetActual = [...shortKSeries].reverse().find((row) => typeof row.assetActual === "number");
    const latestProfitActual = [...shortKSeries].reverse().find((row) => typeof row.cumulativeProfitActual === "number");
    const latestCashAny = latestCashActual ?? [...shortKSeries].reverse().find((row) => typeof row.cashPrediction === "number");
    const latestAssetAny = latestAssetActual ?? [...shortKSeries].reverse().find((row) => typeof row.assetPrediction === "number");
    const latestProfitAny = latestProfitActual ?? [...shortKSeries].reverse().find((row) => typeof row.cumulativeProfitPrediction === "number");

    return {
      cash: typeof latestCashAny?.cashActual === "number" ? latestCashAny.cashActual : latestCashAny?.cashPrediction,
      asset: typeof latestAssetAny?.assetActual === "number" ? latestAssetAny.assetActual : latestAssetAny?.assetPrediction,
      profit: typeof latestProfitAny?.cumulativeProfitActual === "number" ? latestProfitAny.cumulativeProfitActual : latestProfitAny?.cumulativeProfitPrediction,
    };
  }, [shortKSeries]);
  const selectedActuals = parseShortKActuals(selectedMonthly);
  const selectedBudget = shortKBudget(selectedMonthKey, selectedMonthly);
  const previousRow = selectedMonthKey
    ? rows.find((row) => row.month === previousMonth(selectedMonthKey))
    : undefined;
  const previousActuals = parseShortKActuals(previousRow);
  const incomeTotal = shortKIncomeTotal(selectedActuals);
  const outgoTotal = shortKOutgoTotal(selectedActuals, previousActuals);
  const investmentTotal = shortKInvestmentTotal(selectedActuals);
  const incomeBudgetTotal = shortKBudgetIncomeTotal(selectedBudget);
  const investmentBudgetTotal = shortKBudgetInvestmentTotal(selectedBudget);
  const budgetNet = incomeBudgetTotal - selectedBudget.outgoBudget;
  const actualNet = incomeTotal - outgoTotal;
  const budgetVariance = actualNet - budgetNet;
  const selectedHasActuals = hasShortKActuals(selectedActuals);
  const latestEnteredMonth = latestEnteredShortKMonth(rows);
  const predictedDeposit = selectedMonthKey
    ? shortKProjectedBalance(selectedMonthKey, rows, latestEnteredMonth)
    : undefined;
  const canShowCalculatedDeposit = selectedMonthKey
    ? canCalculateShortKDeposit(selectedMonthKey, rows)
    : false;
  const calculatedDeposit =
    selectedMonthKey && canShowCalculatedDeposit
      ? shortKCalculatedDeposit(selectedMonthKey, rows)
      : undefined;
  const updateActual = (key: keyof ShortKActuals, value: number) => {
    if (!selectedMonthKey) return;
    const nextActuals = { ...selectedActuals, [key]: value };
    upsertMonthly(selectedMonthKey, {
      income_budget: selectedBudget.incomeCashBudget,
      income_actual: nextActuals.incomeCash,
      outgo_budget: selectedBudget.outgoBudget,
      outgo_cash: nextActuals.outgoCash,
      outgo_other: nextActuals.outgoPaypay,
      outgo_card: nextActuals.outgoCard,
      invest_budget: investmentBudgetTotal,
      invest_actual: shortKInvestmentTotal(nextActuals),
      usd_actual: nextActuals.usdInvestment,
      cash_prediction: selectedBudget.cashPrediction,
      cash_actual: 0,
      note: buildShortKNote(selectedMonthly, nextActuals),
    });
  };

  const updateBudget = (key: keyof ShortKBudget, value: number) => {
    if (!selectedMonthKey) return;
    const nextBudget = { ...selectedBudget, [key]: value };
    upsertMonthly(selectedMonthKey, {
      income_budget: nextBudget.incomeCashBudget,
      outgo_budget: nextBudget.outgoBudget,
      invest_budget: shortKBudgetInvestmentTotal(nextBudget),
      cash_prediction: nextBudget.cashPrediction,
      note: buildShortKNote(selectedMonthly, selectedActuals, { [key]: value }),
    });
  };

  const updateSelectedYear = (year: string) => {
    setSelectedYear(year);
    if (!year) {
      setSelectedMonthNumber("");
      setSelectedMonth("");
      return;
    }
    if (
      selectedMonthNumber &&
      shortKMonthOptions(year).includes(selectedMonthNumber)
    ) {
      setSelectedMonth(`${year}-${selectedMonthNumber}`);
    } else {
      setSelectedMonthNumber("");
      setSelectedMonth("");
    }
  };
  const updateSelectedMonthNumber = (month: string) => {
    setSelectedMonthNumber(month);
    if (!selectedYear || !month) {
      setSelectedMonth("");
      return;
    }
    setSelectedMonth(`${selectedYear}-${month}`);
  };

  const moveSelectedShortKMonth = (diff: number) => {
    if (!selectedMonthKey) return;
    const [year, month] = selectedMonthKey.split("-").map(Number);
    const date = new Date(year, month - 1 + diff, 1);
    const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!inMonthRange(next)) return;
    setSelectedMonth(next);
  };

  const toggleInputSection = (key: keyof typeof openInputSections) => {
    setOpenInputSections((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  return (
    <section className="stack">
      <div className="chart-tab-panel">
        <div className="chart-tabs">
          <button
            className={`chart-tab ${shortKChartTab === "cash" ? "active" : ""}`}
            onClick={() => setShortKChartTab("cash")}
          >
            総合
          </button>
          <button
            className={`chart-tab ${shortKChartTab === "profit" ? "active" : ""}`}
            onClick={() => setShortKChartTab("profit")}
          >
            通算損益
          </button>
        </div>
        {shortKChartTab === "cash" ? (
          <div className="chart-top-summary two-items">
            <div>
              <span>現在の現金</span>
              <b>{typeof latestShortKSnapshot.cash === "number" ? money(latestShortKSnapshot.cash) : "—"}</b>
            </div>
            <div>
              <span>現在の資産合計</span>
              <b>{typeof latestShortKSnapshot.asset === "number" ? money(latestShortKSnapshot.asset) : "—"}</b>
            </div>
          </div>
        ) : (
          <div className="chart-top-summary">
            <div>
              <span>現在の通算損益</span>
              <b>{typeof latestShortKSnapshot.profit === "number" ? signedMoney(latestShortKSnapshot.profit) : "—"}</b>
            </div>
          </div>
        )}
        {shortKChartTab === "cash" ? (
          <MultiLineChart
            title="総合"
            rows={shortKSeries}
            series={[
              { key: "cashActual", label: "現金", colorIndex: 0 },
              {
                key: "cashPrediction",
                label: "現金予測",
                dashed: true,
                colorIndex: 0,
                hideLegend: true,
              },
              { key: "assetActual", label: "資産合計", colorIndex: 2 },
              {
                key: "assetPrediction",
                label: "資産合計予測",
                dashed: true,
                colorIndex: 2,
                hideLegend: true,
              },
            ]}
            showYAxis
            baselineZero
            storageKey="finance.shortK.chartZoom.cash"
          />
        ) : (
          <MultiLineChart
            title="通算損益"
            rows={shortKSeries}
            series={[
              { key: "cumulativeProfitActual", label: "通算損益", colorIndex: 1 },
              {
                key: "cumulativeProfitPrediction",
                label: "通算損益予測",
                dashed: true,
                colorIndex: 1,
                hideLegend: true,
              },
            ]}
            showYAxis
            storageKey="finance.shortK.chartZoom.profit"
          />
        )}
      </div>

      <section className="grid short-k-layout">
        <div className="flat-panel">
          <div className="flat-panel-head">
            <div className="panel-title">実績入力</div>
          </div>
          <div className="flat-panel-body">
            <div className="month-picker-row">
              <button
                className="month-arrow"
                type="button"
                onClick={() => moveSelectedShortKMonth(-1)}
                disabled={
                  !selectedMonthKey || selectedMonthKey <= SHORT_K_START
                }
              >
                ←
              </button>
              <div className="month-select-grid">
                <label className="field">
                  <span className="label">年</span>
                  <select
                    className="input editable-input"
                    value={selectedYear}
                    onChange={(e) => updateSelectedYear(e.target.value)}
                  >
                    <option value="">選択</option>
                    {shortKYearOptions().map((year) => (
                      <option key={year} value={year}>
                        {year}年
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="label">月</span>
                  <select
                    className="input editable-input"
                    value={selectedMonthNumber}
                    onChange={(e) => updateSelectedMonthNumber(e.target.value)}
                    disabled={!selectedYear}
                  >
                    <option value="">選択</option>
                    {shortKMonthOptions(selectedYear).map((month) => (
                      <option key={month} value={month}>
                        {Number(month)}月
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                className="month-arrow"
                type="button"
                onClick={() => moveSelectedShortKMonth(1)}
                disabled={!selectedMonthKey || selectedMonthKey >= SHORT_K_END}
              >
                →
              </button>
            </div>

            {!selectedMonthly ? (
              <div className="empty-state">年と月を選択してください。</div>
            ) : (
              <div className="budget-actual-list">
                <ShortKInputSection
                  title="収入"
                  summary={
                    <MemoBudgetActualSummary
                      label="収入合計"
                      budget={incomeBudgetTotal}
                      actual={incomeTotal}
                      compact
                    />
                  }
                  open={openInputSections.income}
                  onToggle={() => toggleInputSection("income")}
                >
                  <MemoBudgetActualRow
                    label="現金収入"
                    budget={selectedBudget.incomeCashBudget}
                    actual={selectedActuals.incomeCash}
                    onChange={(value) => updateActual("incomeCash", value)}
                  />
                  <MemoBudgetActualRow
                    label="投資収入"
                    budget={selectedBudget.incomeInvestmentBudget}
                    actual={selectedActuals.incomeInvestment}
                    onChange={(value) =>
                      updateActual("incomeInvestment", value)
                    }
                  />
                  <MemoBudgetActualSummary
                    label="収入合計"
                    budget={incomeBudgetTotal}
                    actual={incomeTotal}
                  />
                </ShortKInputSection>

                <ShortKInputSection
                  title="支出"
                  summary={
                    <MemoBudgetActualSummary
                      label="支出合計"
                      budget={selectedBudget.outgoBudget}
                      actual={outgoTotal}
                      compact
                    />
                  }
                  open={openInputSections.outgo}
                  onToggle={() => toggleInputSection("outgo")}
                >
                  <MemoBudgetActualRow
                    label="現金支出"
                    budget={null}
                    actual={selectedActuals.outgoCash}
                    onChange={(value) => updateActual("outgoCash", value)}
                  />
                  <MemoBudgetActualRow
                    label="PayPay等支出"
                    budget={null}
                    actual={selectedActuals.outgoPaypay}
                    onChange={(value) => updateActual("outgoPaypay", value)}
                  />
                  <MemoBudgetActualRow
                    label="クレジットカード支出"
                    budget={null}
                    actual={selectedActuals.outgoCard}
                    onChange={(value) => updateActual("outgoCard", value)}
                  />
                  <MemoBudgetActualSummary
                    label="支出合計"
                    budget={selectedBudget.outgoBudget}
                    actual={outgoTotal}
                  />
                </ShortKInputSection>

                <ShortKInputSection
                  title="投資"
                  summary={
                    <MemoBudgetActualSummary
                      label="投資合計"
                      budget={investmentBudgetTotal}
                      actual={investmentTotal}
                      compact
                    />
                  }
                  open={openInputSections.investment}
                  onToggle={() => toggleInputSection("investment")}
                >
                  <MemoBudgetActualRow
                    label="投資信託"
                    budget={selectedBudget.fundInvestmentBudget}
                    actual={selectedActuals.fundInvestment}
                    onChange={(value) => updateActual("fundInvestment", value)}
                  />
                  <MemoBudgetActualRow
                    label="アクティブ"
                    budget={selectedBudget.activeInvestmentBudget}
                    actual={selectedActuals.activeInvestment}
                    onChange={(value) =>
                      updateActual("activeInvestment", value)
                    }
                  />
                  <MemoBudgetActualRow
                    label="FX"
                    budget={selectedBudget.usdInvestmentBudget}
                    actual={selectedActuals.usdInvestment}
                    onChange={(value) => updateActual("usdInvestment", value)}
                  />
                  <MemoBudgetActualSummary
                    label="投資合計"
                    budget={investmentBudgetTotal}
                    actual={investmentTotal}
                  />
                </ShortKInputSection>

                <BudgetVarianceCard value={selectedHasActuals ? budgetVariance : null} />
                <div className="result-card deposit">
                  <span>{selectedHasActuals ? "現金" : "現金(予測)"}</span>
                  <b>
                    {selectedHasActuals
                      ? calculatedDeposit === undefined
                        ? "—"
                        : money(calculatedDeposit)
                      : predictedDeposit === undefined
                        ? "—"
                        : money(predictedDeposit)}
                  </b>
                </div>
              </div>
            )}
          </div>
        </div>

        <MemoMonthlyTable
          rows={enteredRows}
          onSelect={handleMonthlySelect}
          onDelete={handleMonthlyDelete}
        />
      </section>
    </section>
  );
}


function ShortKAssetManagementView({
  rows,
  detailRows,
  selectedMonth,
  setSelectedMonth,
  upsertInvestment,
}: {
  rows: MonthlyRecord[];
  detailRows: InvestmentRecord[];
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  upsertInvestment: (
    month: string,
    account: string,
    patch: Partial<InvestmentRecord>,
  ) => void;
}) {
  const [selectedYear, setSelectedYear] = useState(
    selectedMonth ? selectedMonth.slice(0, 4) : "",
  );
  const [selectedMonthNumber, setSelectedMonthNumber] = useState(
    selectedMonth ? selectedMonth.slice(5, 7) : "",
  );
  const [openAssetAccounts, setOpenAssetAccounts] = useState<Record<ShortKAssetAccountKey, boolean>>({
    fund: false,
    active: false,
    usd: false,
  });

  useEffect(() => {
    setSelectedYear(selectedMonth ? selectedMonth.slice(0, 4) : "");
    setSelectedMonthNumber(selectedMonth ? selectedMonth.slice(5, 7) : "");
  }, [selectedMonth]);

  const selectedMonthKey =
    selectedYear && selectedMonthNumber
      ? `${selectedYear}-${selectedMonthNumber}`
      : "";
  const selectedAssetRows = selectedMonthKey
    ? getShortKAssetRows(detailRows, selectedMonthKey)
    : [];
  const selectedAssetSummary = selectedMonthKey
    ? shortKAssetActualSummary(selectedMonthKey, rows, detailRows)
    : { principal: 0, value: 0, profit: 0, hasEvaluation: false };
  const selectedAssetProfitRate = signedRate(
    selectedAssetSummary.profit,
    selectedAssetSummary.principal,
  );

  const updateSelectedYear = (year: string) => {
    setSelectedYear(year);
    if (!year) {
      setSelectedMonthNumber("");
      setSelectedMonth("");
      return;
    }
    if (
      selectedMonthNumber &&
      shortKMonthOptions(year).includes(selectedMonthNumber)
    ) {
      setSelectedMonth(`${year}-${selectedMonthNumber}`);
    } else {
      setSelectedMonthNumber("");
      setSelectedMonth("");
    }
  };

  const updateSelectedMonthNumber = (month: string) => {
    setSelectedMonthNumber(month);
    if (!selectedYear || !month) {
      setSelectedMonth("");
      return;
    }
    setSelectedMonth(`${selectedYear}-${month}`);
  };

  const moveSelectedShortKMonth = (diff: number) => {
    if (!selectedMonthKey) return;
    const [year, month] = selectedMonthKey.split("-").map(Number);
    const date = new Date(year, month - 1 + diff, 1);
    const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!inMonthRange(next)) return;
    setSelectedMonth(next);
  };

  const toggleAssetAccount = (key: ShortKAssetAccountKey) => {
    setOpenAssetAccounts((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const updateAssetValue = (account: ShortKAssetAccountKey, value: number) => {
    if (!selectedMonthKey) return;
    const config = SHORT_K_ASSET_ACCOUNTS[account];
    upsertInvestment(selectedMonthKey, config.account, {
      capital: shortKAccountPrincipal(account, selectedMonthKey, rows, detailRows),
      actual_balance: value,
      predicted_balance: shortKAccountPredictedValue(
        account,
        selectedMonthKey,
        rows,
        detailRows,
      ),
    });
  };

  return (
    <section className="stack">
      <div className="flat-panel">
        <div className="flat-panel-head">
          <div className="panel-title">資産管理</div>
        </div>
        <div className="flat-panel-body">
          <div className="month-picker-row">
            <button
              className="month-arrow"
              type="button"
              onClick={() => moveSelectedShortKMonth(-1)}
              disabled={!selectedMonthKey || selectedMonthKey <= SHORT_K_START}
            >
              ←
            </button>
            <div className="month-select-grid">
              <label className="field">
                <span className="label">年</span>
                <select
                  className="input editable-input"
                  value={selectedYear}
                  onChange={(e) => updateSelectedYear(e.target.value)}
                >
                  <option value="">選択</option>
                  {shortKYearOptions().map((year) => (
                    <option key={year} value={year}>
                      {year}年
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">月</span>
                <select
                  className="input editable-input"
                  value={selectedMonthNumber}
                  onChange={(e) => updateSelectedMonthNumber(e.target.value)}
                  disabled={!selectedYear}
                >
                  <option value="">選択</option>
                  {shortKMonthOptions(selectedYear).map((month) => (
                    <option key={month} value={month}>
                      {Number(month)}月
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="month-arrow"
              type="button"
              onClick={() => moveSelectedShortKMonth(1)}
              disabled={!selectedMonthKey || selectedMonthKey >= SHORT_K_END}
            >
              →
            </button>
          </div>

          {!selectedMonthKey ? (
            <div className="empty-state">年と月を選択してください。</div>
          ) : (
            <div className="stack">
              <div className="flat-summary-block">
                <div className="budget-actual-label">資産管理合計</div>
                <div className="flat-summary-grid">
                  <div>
                    <span className="mini-label">元本合計</span>
                    <b>{money(selectedAssetSummary.principal)}</b>
                    {!selectedAssetSummary.hasEvaluation && (
                      <span className="sub-value">予測額 {money(shortKAssetSummary(selectedMonthKey, rows, detailRows).value)}</span>
                    )}
                  </div>
                  {selectedAssetSummary.hasEvaluation && (
                    <div>
                      <span className="mini-label">評価額合計</span>
                      <b>{money(selectedAssetSummary.value)}</b>
                    </div>
                  )}
                </div>
                {selectedAssetSummary.hasEvaluation && (
                  <div className="flat-result-row">
                    <span>損益</span>
                    <b className={selectedAssetSummary.profit < 0 ? "negative" : "positive"}>
                      {signedMoney(selectedAssetSummary.profit)}（{selectedAssetProfitRate}）
                    </b>
                  </div>
                )}
              </div>

              {(Object.keys(SHORT_K_ASSET_ACCOUNTS) as ShortKAssetAccountKey[]).map((key) => {
                const config = SHORT_K_ASSET_ACCOUNTS[key];
                const row = selectedAssetRows.find((item) => shortKAssetRowMatches(item, config.account));
                const principal = shortKAccountPrincipal(key, selectedMonthKey, rows, detailRows);
                const hasEvaluation = !!row && row.actual_balance !== 0;
                const evaluation = hasEvaluation ? row.actual_balance : 0;
                const profit = hasEvaluation && principal > 0 ? evaluation - principal : 0;
                const profitRate = signedRate(profit, principal);

                return (
                  <div className="short-k-input-section" key={key}>
                    <button
                      className="short-k-input-section-head"
                      type="button"
                      onClick={() => toggleAssetAccount(key)}
                    >
                      <span>{openAssetAccounts[key] ? "▼" : "▶"} {config.label}</span>
                    </button>
                    {openAssetAccounts[key] && (
                      <div className="short-k-input-section-body">
                        <div className="flat-account-input">
                          <div className="budget-actual-label">{config.label}</div>
                          <div className="budget-actual-two-col">
                            <div className="readonly-box flat-readonly-box">
                              <span className="mini-label">元本</span>
                              <b>{money(principal)}</b>
                              {!hasEvaluation && (
                                <span className="sub-value">予測額 {money(shortKAccountPredictedValue(key, selectedMonthKey, rows, detailRows))}</span>
                              )}
                            </div>
                            <label className="actual-input-box flat-input-box">
                              <span className="mini-label">評価額</span>
                              <MoneyInput
                                value={evaluation}
                                onChange={(nextValue) => updateAssetValue(key, nextValue)}
                              />
                            </label>
                          </div>
                        </div>
                        {hasEvaluation && (
                          <div className="flat-result-row compact">
                            <span>損益</span>
                            <b className={profit < 0 ? "negative" : "positive"}>{signedMoney(profit)}（{profitRate}）</b>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}


function BudgetSettingsView({
  rows,
  selectedMonth,
  setSelectedMonth,
  upsertMonthly,
}: {
  rows: MonthlyRecord[];
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  upsertMonthly: (month: string, patch: Partial<MonthlyRecord>) => void;
}) {
  const [selectedYear, setSelectedYear] = useState(
    selectedMonth ? selectedMonth.slice(0, 4) : "",
  );
  const [selectedMonthNumber, setSelectedMonthNumber] = useState(
    selectedMonth ? selectedMonth.slice(5, 7) : "",
  );

  useEffect(() => {
    setSelectedYear(selectedMonth ? selectedMonth.slice(0, 4) : "");
    setSelectedMonthNumber(selectedMonth ? selectedMonth.slice(5, 7) : "");
  }, [selectedMonth]);

  const selectedMonthKey =
    selectedYear && selectedMonthNumber
      ? `${selectedYear}-${selectedMonthNumber}`
      : "";
  const selectedMonthly = selectedMonthKey
    ? monthlyForMonth(rows, selectedMonthKey)
    : undefined;
  const selectedActuals = parseShortKActuals(selectedMonthly);
  const selectedBudget = shortKBudget(selectedMonthKey, selectedMonthly);
  const [pendingBudgetChange, setPendingBudgetChange] = useState<{
    key: keyof ShortKBudget;
    value: number;
  } | null>(null);

  const applyBudgetChange = (
    key: keyof ShortKBudget,
    value: number,
    applyToFuture: boolean,
  ) => {
    if (!selectedMonthKey) return;
    const targetMonths = applyToFuture
      ? monthsBetween(selectedMonthKey, SHORT_K_END)
      : [selectedMonthKey];

    targetMonths.forEach((targetMonth) => {
      const targetRow = rows.find((row) => row.month === targetMonth);
      const targetActuals = parseShortKActuals(targetRow);
      const targetBudget = {
        ...shortKBudget(targetMonth, targetRow),
        [key]: value,
      };
      upsertMonthly(targetMonth, {
        income_budget: targetBudget.incomeCashBudget,
        outgo_budget: targetBudget.outgoBudget,
        invest_budget: shortKBudgetInvestmentTotal(targetBudget),
        cash_prediction: targetBudget.cashPrediction,
        note: buildShortKNote(targetRow, targetActuals, { [key]: value }),
      });
    });
  };

  const budgetLabel = (key: keyof ShortKBudget) =>
    ({
      incomeCashBudget: "現金収入",
      incomeInvestmentBudget: "投資収入",
      outgoBudget: "支出",
      fundInvestmentBudget: "投資信託",
      activeInvestmentBudget: "アクティブ",
      usdInvestmentBudget: "FX",
      cashPrediction: "現金予測",
    })[key];

  const updateSelectedYear = (year: string) => {
    setSelectedYear(year);
    if (!year) {
      setSelectedMonthNumber("");
      setSelectedMonth("");
      return;
    }
    if (
      selectedMonthNumber &&
      shortKMonthOptions(year).includes(selectedMonthNumber)
    ) {
      setSelectedMonth(`${year}-${selectedMonthNumber}`);
    } else {
      setSelectedMonthNumber("");
      setSelectedMonth("");
    }
  };

  const updateSelectedMonthNumber = (month: string) => {
    setSelectedMonthNumber(month);
    if (!selectedYear || !month) {
      setSelectedMonth("");
      return;
    }
    setSelectedMonth(`${selectedYear}-${month}`);
  };

  const moveSelectedShortKMonth = (diff: number) => {
    if (!selectedMonthKey) return;
    const [year, month] = selectedMonthKey.split("-").map(Number);
    const date = new Date(year, month - 1 + diff, 1);
    const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!inMonthRange(next)) return;
    setSelectedMonth(next);
  };

  const updateBudget = (key: keyof ShortKBudget, value: number) => {
    if (!selectedMonthKey) return;
    setPendingBudgetChange({ key, value });
  };

  return (
    <section className="stack">
      <div className="flat-panel">
        <div className="flat-panel-head">
          <div className="panel-title">予算設定</div>
        </div>
        <div className="flat-panel-body">
          <div className="month-picker-row">
            <button
              className="month-arrow"
              type="button"
              onClick={() => moveSelectedShortKMonth(-1)}
              disabled={!selectedMonthKey || selectedMonthKey <= SHORT_K_START}
            >
              ←
            </button>
            <div className="month-select-grid">
              <label className="field">
                <span className="label">年</span>
                <select
                  className="input editable-input"
                  value={selectedYear}
                  onChange={(e) => updateSelectedYear(e.target.value)}
                >
                  <option value="">選択</option>
                  {shortKYearOptions().map((year) => (
                    <option key={year} value={year}>
                      {year}年
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">月</span>
                <select
                  className="input editable-input"
                  value={selectedMonthNumber}
                  onChange={(e) => updateSelectedMonthNumber(e.target.value)}
                  disabled={!selectedYear}
                >
                  <option value="">選択</option>
                  {shortKMonthOptions(selectedYear).map((month) => (
                    <option key={month} value={month}>
                      {Number(month)}月
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="month-arrow"
              type="button"
              onClick={() => moveSelectedShortKMonth(1)}
              disabled={!selectedMonthKey || selectedMonthKey >= SHORT_K_END}
            >
              →
            </button>
          </div>

          {!selectedMonthKey ? (
            <div className="empty-state">年と月を選択してください。</div>
          ) : (
            <div className="budget-settings-list">
              <BudgetSettingRow
                label="現金収入"
                value={selectedBudget.incomeCashBudget}
                onChange={(value) => updateBudget("incomeCashBudget", value)}
              />
              <BudgetSettingRow
                label="投資収入"
                value={selectedBudget.incomeInvestmentBudget}
                onChange={(value) => updateBudget("incomeInvestmentBudget", value)}
              />
              <BudgetSettingRow
                label="支出"
                value={selectedBudget.outgoBudget}
                onChange={(value) => updateBudget("outgoBudget", value)}
              />
              <BudgetSettingRow
                label="投資信託"
                value={selectedBudget.fundInvestmentBudget}
                onChange={(value) => updateBudget("fundInvestmentBudget", value)}
              />
              <BudgetSettingRow
                label="アクティブ"
                value={selectedBudget.activeInvestmentBudget}
                onChange={(value) => updateBudget("activeInvestmentBudget", value)}
              />
              <BudgetSettingRow
                label="FX"
                value={selectedBudget.usdInvestmentBudget}
                onChange={(value) => updateBudget("usdInvestmentBudget", value)}
              />
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog
        config={
          pendingBudgetChange
            ? {
                title: "予算を変更",
                message: `${budgetLabel(pendingBudgetChange.key)}を以降の月にも反映しますか？`,
                cancelLabel: "この月のみ",
                confirmLabel: "OK",
                onCancel: () =>
                  applyBudgetChange(
                    pendingBudgetChange.key,
                    pendingBudgetChange.value,
                    false,
                  ),
                onConfirm: () =>
                  applyBudgetChange(
                    pendingBudgetChange.key,
                    pendingBudgetChange.value,
                    true,
                  ),
              }
            : null
        }
        onClose={() => setPendingBudgetChange(null)}
      />
    </section>
  );
}

function BudgetSettingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="budget-setting-row">
      <span className="budget-actual-label">{label}</span>
      <MoneyInput value={value} onChange={onChange} commitOnBlur />
    </label>
  );
}

function ShortMView({
  rows,
  detailRows,
  selectedInvestment,
  selectedInvestmentId,
  setSelectedInvestmentId,
  updateInvestment,
  addInvestment,
  deleteInvestment,
  inputOpen,
  setInputOpen,
}: {
  rows: InvestmentRecord[];
  detailRows: InvestmentRecord[];
  selectedInvestment?: InvestmentRecord;
  selectedInvestmentId: string;
  setSelectedInvestmentId: (id: string) => void;
  updateInvestment: (row: InvestmentRecord) => void;
  addInvestment: () => void;
  deleteInvestment: (id: string) => void;
  inputOpen: boolean;
  setInputOpen: (open: boolean) => void;
}) {
  return (
    <section className="grid wide-left">
      <div className="stack">
        <MultiLineChart
          title="短期M 推移"
          badge="M23-30inv"
          rows={buildInvestmentAccountSeries(rows, SHORT_M_ACCOUNTS)}
          series={SHORT_M_ACCOUNTS.map((account) => ({
            key: account,
            label: account,
          }))}
        />
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">現在の保有状況</div>
            <span className="badge">M23-30inv</span>
          </div>
          <div className="panel-body">
            <AssetCards rows={detailRows} />
          </div>
        </div>
        <AllocationPanel rows={detailRows} />
      </div>
      <div className="stack">
        <CollapsiblePanel
          title="月末入力"
          badge="Cash / WealthNavi / NASDAQ100 / NISA"
          open={inputOpen}
          setOpen={setInputOpen}
        >
          {selectedInvestment ? (
            <>
              <div className="field">
                <span className="label">編集行</span>
                <select
                  className="input"
                  value={selectedInvestmentId}
                  onChange={(e) => setSelectedInvestmentId(e.target.value)}
                >
                  {rows.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.month} / {row.account}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-grid">
                <div className="field">
                  <span className="label">月</span>
                  <MonthInput
                    value={selectedInvestment.month}
                    onChange={(month) =>
                      updateInvestment({ ...selectedInvestment, month })
                    }
                  />
                </div>
                <div className="field">
                  <span className="label">項目</span>
                  <select
                    className="input"
                    value={selectedInvestment.account}
                    onChange={(e) =>
                      updateInvestment({
                        ...selectedInvestment,
                        account: e.target.value,
                      })
                    }
                  >
                    {SHORT_M_ACCOUNTS.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <span className="label">元本</span>
                  <NumberInput
                    value={selectedInvestment.capital}
                    onChange={(capital) =>
                      updateInvestment({ ...selectedInvestment, capital })
                    }
                  />
                </div>
                <div className="field">
                  <span className="label">現在額</span>
                  <NumberInput
                    value={investmentValue(selectedInvestment)}
                    onChange={(actual_balance) =>
                      updateInvestment({
                        ...selectedInvestment,
                        actual_balance,
                      })
                    }
                  />
                </div>
                <div className="field">
                  <span className="label">入金</span>
                  <NumberInput
                    value={selectedInvestment.deposit}
                    onChange={(deposit) =>
                      updateInvestment({ ...selectedInvestment, deposit })
                    }
                  />
                </div>
                <div className="field">
                  <span className="label">出金</span>
                  <NumberInput
                    value={selectedInvestment.withdrawal}
                    onChange={(withdrawal) =>
                      updateInvestment({ ...selectedInvestment, withdrawal })
                    }
                  />
                </div>
              </div>
              <button className="btn" onClick={addInvestment}>
                行を追加
              </button>
            </>
          ) : (
            <button className="btn" onClick={addInvestment}>
              最初の行を追加
            </button>
          )}
        </CollapsiblePanel>
        <InvestmentTable
          rows={rows}
          onSelect={setSelectedInvestmentId}
          onDelete={deleteInvestment}
        />
      </div>
    </section>
  );
}

function AssetCompositionPie({
  rows,
  total,
  selectedId,
  onSelect,
}: {
  rows: { id: string; name: string; value: number }[];
  total: number;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const positiveRows = rows.filter((row) => row.value > 0);
  let current = 0;
  const radius = 44;
  const center = 50;

  const point = (ratio: number) => {
    const angle = ratio * Math.PI * 2 - Math.PI / 2;
    return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) };
  };

  return (
    <div className="flat-panel composition-panel">
      <div className="flat-panel-head compact-head">
        <div className="panel-title">構成銘柄</div>
        <span className="badge">合計 {money(total)}</span>
      </div>
      <div className="composition-body">
        {positiveRows.length === 0 ? (
          <div className="empty-state">評価額のある銘柄がありません。</div>
        ) : (
          <>
            <svg className="composition-pie" viewBox="0 0 100 100" role="img" aria-label="構成銘柄の評価額">
              {positiveRows.map((row, index) => {
                const start = current / total;
                current += row.value;
                const end = current / total;
                const startPoint = point(start);
                const endPoint = point(end);
                const largeArc = end - start > 0.5 ? 1 : 0;
                const selected = row.id === selectedId;
                return (
                  <path
                    key={row.id}
                    className={`composition-slice slice-${index % 8} ${selected ? "selected" : ""}`}
                    d={`M ${center} ${center} L ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${largeArc} 1 ${endPoint.x} ${endPoint.y} Z`}
                    onClick={() => onSelect(row.id)}
                  />
                );
              })}
              <circle cx={center} cy={center} r="24" className="composition-hole" />
            </svg>
            <div className="composition-legend">
              {positiveRows.map((row, index) => (
                <button
                  key={row.id}
                  type="button"
                  className={`composition-legend-row ${row.id === selectedId ? "active" : ""}`}
                  onClick={() => onSelect(row.id)}
                >
                  <span className={`legend-dot slice-${index % 8}`} />
                  <span>{row.name}</span>
                  <b>{money(row.value)}</b>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AssetHoldingDetailEditor({
  title,
  units,
  price,
  value,
  onUnitsChange,
}: {
  title: string;
  units: number;
  price: number;
  value: number;
  onUnitsChange: (value: number) => void;
}) {
  return (
    <div className="selected-asset-detail editable-selected-asset-detail">
      <div className="selected-asset-title">{title}</div>
      <div className="selected-asset-grid editable">
        <label className="selected-asset-edit-field">
          <span>保有数</span>
          <FormattedNumberInput value={units} onChange={onUnitsChange} />
        </label>
        <div><span>基準価額</span><b>{formatCount(price)}</b></div>
        <div><span>評価額</span><b>{money(value)}</b></div>
      </div>
    </div>
  );
}

function MomentumView({
  title,
  state,
  selectedFund,
  selectedTicker,
  selectedFundId,
  selectedTickerId,
  setSelectedFundId,
  setSelectedTickerId,
  updateFund,
  updateTicker,
  addFund,
  addTicker,
  deleteFund,
  deleteTicker,
}: {
  title?: string;
  state: FinanceState;
  selectedFund: FundRecord;
  selectedTicker: TickerHolding;
  selectedFundId: string;
  selectedTickerId: string;
  setSelectedFundId: (id: string) => void;
  setSelectedTickerId: (id: string) => void;
  updateFund: (row: FundRecord) => void;
  updateTicker: (row: TickerHolding) => void;
  addFund: () => void;
  addTicker: () => void;
  deleteFund: (id: string) => void;
  deleteTicker: (id: string) => void;
}) {
  const isFund = title === "投資信託";
  const fundEvaluationTotal = useMemo(
    () => state.funds.reduce((sum, row) => sum + fundEvaluation(row), 0),
    [state.funds],
  );
  const tickerEvaluationTotal = useMemo(
    () => state.tickers.reduce((sum, row) => sum + tickerEvaluation(row), 0),
    [state.tickers],
  );
  const fetchedMarketKeysRef = useRef<Set<string>>(new Set());
  const [marketPriceStatus, setMarketPriceStatus] = useState("");

  const refreshFundPrice = useCallback(
    async (row: FundRecord, force = false) => {
      const symbol = row.name?.trim();
      if (!symbol) return;
      const key = `fund:${row.id}:${symbol}`;
      if (!force && fetchedMarketKeysRef.current.has(key)) return;
      fetchedMarketKeysRef.current.add(key);
      setMarketPriceStatus(`${symbol} の基準価額を確認中`);
      const price = await fetchLatestMarketPrice(symbol);
      if (!price) {
        setMarketPriceStatus(`${symbol} の基準価額を取得できませんでした`);
        return;
      }
      setMarketPriceStatus(`${symbol} の基準価額を更新しました`);
      if (Math.round(price * 10000) === Math.round(n(row.price) * 10000)) return;
      updateFund({ ...row, price });
    },
    [updateFund],
  );

  const refreshTickerPrice = useCallback(
    async (row: TickerHolding, force = false) => {
      const symbol = row.ticker?.trim();
      if (!symbol) return;
      const key = `ticker:${row.id}:${symbol}`;
      if (!force && fetchedMarketKeysRef.current.has(key)) return;
      fetchedMarketKeysRef.current.add(key);
      setMarketPriceStatus(`${symbol} の基準価額を確認中`);
      const price = await fetchLatestMarketPrice(symbol);
      if (!price) {
        setMarketPriceStatus(`${symbol} の基準価額を取得できませんでした`);
        return;
      }
      setMarketPriceStatus(`${symbol} の基準価額を更新しました`);
      if (Math.round(price * 10000) === Math.round(n(row.price) * 10000)) return;
      updateTicker({ ...row, price });
    },
    [updateTicker],
  );

  useEffect(() => {
    if (!isFund) return;
    state.funds.forEach((row) => {
      void refreshFundPrice(row);
    });
  }, [isFund, state.funds, refreshFundPrice]);

  useEffect(() => {
    if (isFund) return;
    state.tickers.forEach((row) => {
      void refreshTickerPrice(row);
    });
  }, [isFund, state.tickers, refreshTickerPrice]);

  if (isFund) {
    return (
      <section className="stack asset-product-view">
        <AssetCompositionPie
          rows={state.funds.map((row) => ({
            id: row.id,
            name: row.name || "未設定",
            value: fundEvaluation(row),
          }))}
          total={fundEvaluationTotal}
          selectedId={selectedFundId}
          onSelect={setSelectedFundId}
        />

        {selectedFund ? (
          <AssetHoldingDetailEditor
            title={selectedFund.name || "未設定"}
            units={selectedFund.units}
            price={selectedFund.price}
            value={fundEvaluation(selectedFund)}
            onUnitsChange={(units) => updateFund({ ...selectedFund, units })}
          />
        ) : (
          <div className="empty-state">銘柄を追加してください。</div>
        )}

        <div className="flat-panel asset-product-edit-panel">
          <div className="flat-panel-head compact-head">
            <div className="panel-title">銘柄の追加・編集</div>
            <button className="btn primary" type="button" onClick={addFund}>追加</button>
          </div>
          <div className="flat-panel-body">
            {selectedFund ? (
              <div className="asset-product-editor compact">
                <label className="field">
                  <span className="label">商品名</span>
                  <TextInput value={selectedFund.name} onChange={(name) => updateFund({ ...selectedFund, name })} placeholder="商品名・コード" />
                </label>
                <label className="field">
                  <span className="label">保有数</span>
                  <FormattedNumberInput value={selectedFund.units} onChange={(units) => updateFund({ ...selectedFund, units })} />
                </label>
                <div className="readonly-box flat-readonly-box">
                  <span className="mini-label">基準価額</span>
                  <b>{formatCount(selectedFund.price)}</b>
                </div>
                <button className="btn ghost" type="button" onClick={() => void refreshFundPrice(selectedFund, true)}>基準価額を更新</button>
                <button className="btn danger" type="button" onClick={() => deleteFund(selectedFund.id)}>削除</button>
              </div>
            ) : (
              <div className="empty-state">追加ボタンで銘柄を作成してください。</div>
            )}
          </div>
        </div>

        {marketPriceStatus ? <div className="asset-price-status">{marketPriceStatus}</div> : null}
        <FundTable rows={state.funds} onSelect={setSelectedFundId} onDelete={deleteFund} />
      </section>
    );
  }


  return (
    <section className="stack asset-product-view">
      <AssetCompositionPie
        rows={state.tickers.map((row) => ({
          id: row.id,
          name: row.ticker || "未設定",
          value: tickerEvaluation(row),
        }))}
        total={tickerEvaluationTotal}
        selectedId={selectedTickerId}
        onSelect={setSelectedTickerId}
      />

      {selectedTicker ? (
        <AssetHoldingDetailEditor
          title={selectedTicker.ticker || "未設定"}
          units={Math.max(1, n(selectedTicker.shares))}
          price={selectedTicker.price}
          value={tickerEvaluation(selectedTicker)}
          onUnitsChange={(shares) => updateTicker({ ...selectedTicker, shares: Math.max(1, shares) })}
        />
      ) : (
        <div className="empty-state">銘柄を追加してください。</div>
      )}

      <div className="flat-panel asset-product-edit-panel">
        <div className="flat-panel-head compact-head">
          <div className="panel-title">銘柄の追加・編集</div>
          <button className="btn primary" type="button" onClick={addTicker}>追加</button>
        </div>
        <div className="flat-panel-body">
          {selectedTicker ? (
            <div className="asset-product-editor compact">
              <label className="field">
                <span className="label">商品名</span>
                <TextInput value={selectedTicker.ticker} onChange={(ticker) => updateTicker({ ...selectedTicker, ticker })} placeholder="ティッカー・商品名" />
              </label>
              <label className="field">
                <span className="label">保有数</span>
                <FormattedNumberInput value={Math.max(1, n(selectedTicker.shares))} onChange={(shares) => updateTicker({ ...selectedTicker, shares: Math.max(1, shares) })} />
              </label>
              <div className="readonly-box flat-readonly-box">
                <span className="mini-label">基準価額</span>
                <b>{formatCount(selectedTicker.price)}</b>
              </div>
              <button className="btn ghost" type="button" onClick={() => void refreshTickerPrice(selectedTicker, true)}>基準価額を更新</button>
              <button className="btn danger" type="button" onClick={() => deleteTicker(selectedTicker.id)}>削除</button>
            </div>
          ) : (
            <div className="empty-state">追加ボタンで銘柄を作成してください。</div>
          )}
        </div>
      </div>

      {marketPriceStatus ? <div className="asset-price-status">{marketPriceStatus}</div> : null}
      <TickerTable rows={state.tickers} onSelect={setSelectedTickerId} onDelete={deleteTicker} />
    </section>
  );
}


function addDays(dateString: string, diff: number) {
  const base = dateString ? new Date(`${dateString}T00:00:00`) : new Date();
  base.setDate(base.getDate() + diff);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}

function FxView({
  rows,
  setSelectedFxId,
  addFx,
  deleteFx,
}: {
  rows: FxTrade[];
  selectedFx: FxTrade;
  selectedFxId: string;
  setSelectedFxId: (id: string) => void;
  updateFx: (row: FxTrade) => void;
  addFx: (patch?: Partial<FxTrade>) => void;
  deleteFx: (id: string) => void;
  risk: FxRiskInput;
  updateRisk: (row: FxRiskInput) => void;
  floatingLoss: number;
  requiredMargin: number;
  shortage: number;
  losscutRate: number;
}) {
  const [recordDate, setRecordDate] = useState(todayString());
  const [recordResult, setRecordResult] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setRecordDate(todayString()), 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  const recordFxResult = () => {
    addFx({ date: recordDate || todayString(), result: recordResult, memo: null });
    setRecordResult(0);
  };

  return (
    <section className="stack fx-asset-view">
      <div className="flat-panel">
        <div className="flat-panel-head">
          <div className="panel-title">FX確定損益</div>
        </div>
        <div className="flat-panel-body">
          <div className="fx-record-form">
            <div className="fx-date-block">
              <span className="label">日付</span>
              <div className="fx-date-control">
                <button className="month-arrow" type="button" onClick={() => setRecordDate(addDays(recordDate, -1))}>←</button>
                <input className="input fx-date-input" type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} />
                <button className="month-arrow" type="button" onClick={() => setRecordDate(addDays(recordDate, 1))}>→</button>
              </div>
            </div>
            <label className="field">
              <span className="label">損益</span>
              <MoneyInput value={recordResult} onChange={setRecordResult} commitOnBlur />
            </label>
            <button className="btn primary full-width" type="button" onClick={recordFxResult}>記録</button>
          </div>
        </div>
      </div>

      <FxTable rows={rows} onSelect={setSelectedFxId} onDelete={deleteFx} />
    </section>
  );
}


function LongPlanView({
  title,
  badge,
  rows,
  accountOptions,
  selectedInvestmentId,
  setSelectedInvestmentId,
  updateInvestment,
  addInvestment,
  deleteInvestment,
}: {
  title: string;
  badge: string;
  rows: InvestmentRecord[];
  accountOptions: string[];
  selectedInvestmentId: string;
  setSelectedInvestmentId: (id: string) => void;
  updateInvestment: (row: InvestmentRecord) => void;
  addInvestment: () => void;
  deleteInvestment: (id: string) => void;
}) {
  const selected =
    rows.find((row) => row.id === selectedInvestmentId) ?? rows[0];
  const monthlySeries = buildInvestmentMonthlySeries(rows);

  return (
    <section className="grid wide-left">
      <div className="stack">
        <LineLikeChart title={`${title} 推移`} rows={monthlySeries} />

        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">{badge} の内容</div>
            <span className="badge">Excel項目を一旦そのまま整理</span>
          </div>
          <div className="panel-body">
            <div className="chip-row">
              {(badge === "K30-60gen"
                ? [
                    "cash",
                    "cash ratio",
                    "ROBOPRO in",
                    "NASDAQ100 in",
                    "universe in",
                    "ROBOPRO capital",
                    "INDEX capital",
                    "Active capital",
                    "投資口座予測",
                    "年収",
                    "支出",
                    "赤字",
                    "cashing",
                  ]
                : [
                    "cash",
                    "cash ratio",
                    "wealthnavi in",
                    "NASDAQ100 in",
                    "wealthnavi capital",
                    "NASDAQ100 capital",
                    "NISA account",
                    "年収",
                    "支出",
                    "赤字",
                    "cashing",
                  ]
              ).map((name) => (
                <span className="chip" key={name}>
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>

        <LongPlanTable
          rows={rows}
          onSelect={setSelectedInvestmentId}
          onDelete={deleteInvestment}
          badge={badge}
        />
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">{title} 入力</div>
          <button className="btn" onClick={addInvestment}>
            追加
          </button>
        </div>
        <div className="panel-body">
          {selected ? (
            <>
              <div className="field">
                <span className="label">編集行</span>
                <select
                  className="input"
                  value={selected.id}
                  onChange={(e) => setSelectedInvestmentId(e.target.value)}
                >
                  {rows.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.month} / {row.account}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-grid">
                <div className="field">
                  <span className="label">年月</span>
                  <MonthInput
                    value={selected.month}
                    onChange={(month) =>
                      updateInvestment({ ...selected, month })
                    }
                  />
                </div>
                <div className="field">
                  <span className="label">シート</span>
                  <select
                    className="input"
                    value={selected.account}
                    onChange={(e) =>
                      updateInvestment({ ...selected, account: e.target.value })
                    }
                  >
                    {accountOptions.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <span className="label">入金</span>
                  <NumberInput
                    value={selected.deposit}
                    onChange={(deposit) =>
                      updateInvestment({ ...selected, deposit })
                    }
                  />
                </div>
                <div className="field">
                  <span className="label">出金 / cashing</span>
                  <NumberInput
                    value={selected.withdrawal}
                    onChange={(withdrawal) =>
                      updateInvestment({ ...selected, withdrawal })
                    }
                  />
                </div>
                <div className="field">
                  <span className="label">元本 / capital</span>
                  <NumberInput
                    value={selected.capital}
                    onChange={(capital) =>
                      updateInvestment({ ...selected, capital })
                    }
                  />
                </div>
                <div className="field">
                  <span className="label">予測残高</span>
                  <NumberInput
                    value={selected.predicted_balance}
                    onChange={(predicted_balance) =>
                      updateInvestment({ ...selected, predicted_balance })
                    }
                  />
                </div>
                <div className="field">
                  <span className="label">実績残高</span>
                  <NumberInput
                    value={selected.actual_balance}
                    onChange={(actual_balance) =>
                      updateInvestment({ ...selected, actual_balance })
                    }
                  />
                </div>
                <div className="field">
                  <span className="label">月利 / ratio</span>
                  <NumberInput
                    value={selected.monthly_return_rate}
                    onChange={(monthly_return_rate) =>
                      updateInvestment({ ...selected, monthly_return_rate })
                    }
                  />
                </div>
                <div className="field full">
                  <span className="label">メモ</span>
                  <TextInput
                    value={selected.note ?? ""}
                    onChange={(note) => updateInvestment({ ...selected, note })}
                  />
                </div>
              </div>
            </>
          ) : (
            <button className="btn" onClick={addInvestment}>
              最初の行を追加
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function CollapsiblePanel({
  title,
  badge,
  open,
  setOpen,
  children,
}: {
  title: string;
  badge?: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="panel">
      <button
        className="panel-head collapse-head"
        onClick={() => setOpen(!open)}
      >
        <div className="panel-title">
          {open ? "▼" : "▶"} {title}
        </div>
        {badge && <span className="badge">{badge}</span>}
      </button>
      {open && <div className="panel-body">{children}</div>}
    </div>
  );
}

function LineLikeChart({
  title,
  rows,
}: {
  title: string;
  badge?: string;
  rows: { label: string; value: number }[];
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">{title}</div>
        <span className="badge">推移</span>
      </div>
      <div className="panel-body">
        <div className="mini-chart">
          {rows.map((row) => (
            <div className="chart-item" key={row.label}>
              <div
                className="bar"
                style={{ height: `${Math.max((row.value / max) * 100, 4)}%` }}
              />
              <div className="chart-label">{row.label.slice(2)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MultiLineChart({
  title,
  rows,
  series,
  showYAxis = false,
  baselineZero = false,
  storageKey,
}: {
  title: string;
  badge?: string;
  rows: Record<string, string | number | undefined>[];
  series: {
    key: string;
    label: string;
    dashed?: boolean;
    colorIndex?: number;
    hideLegend?: boolean;
  }[];
  showYAxis?: boolean;
  baselineZero?: boolean;
  storageKey?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [selectedPoint, setSelectedPoint] = useState<{
    label: string;
    seriesLabel: string;
    value: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!storageKey) return;
    const savedZoom = Number(readLocalStorage(storageKey));
    if (Number.isFinite(savedZoom) && savedZoom > 0) {
      setZoom(savedZoom);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    writeLocalStorage(storageKey, String(zoom));
  }, [storageKey, zoom]);

  const chartValue = (
    row: Record<string, string | number | undefined>,
    key: string,
  ) => {
    const value = row[key];
    return typeof value === "number" && Number.isFinite(value)
      ? value
      : undefined;
  };

  const visibleWidth = 390;
  const height = 310;
  const axisWidth = showYAxis ? 58 : 0;
  const padLeft = showYAxis ? 8 : 24;
  const padRight = 18;
  const padTop = 22;
  const padBottom = 42;
  const plotBottom = height - padBottom;
  const baseStep = 18;
  const xStep = baseStep * zoom;
  const scrollViewportWidth = Math.max(160, visibleWidth - axisWidth);
  const minZoomForFullView = Math.max(0.02, (scrollViewportWidth - padLeft - padRight) / Math.max(Math.max(rows.length - 1, 1) * baseStep, 1));
  const width = Math.max(scrollViewportWidth, padLeft + padRight + Math.max(rows.length - 1, 1) * xStep);
  const visibleStart = Math.max(0, Math.floor((scrollLeft - padLeft) / xStep) - 2);
  const visibleCount = Math.ceil(scrollViewportWidth / xStep) + 6;
  const visibleEnd = Math.min(rows.length, visibleStart + visibleCount);
  const visibleRows = rows.slice(visibleStart, Math.max(visibleEnd, visibleStart + 1));
  const domainRows = visibleRows.length ? visibleRows : rows;
  const numericValues = domainRows.flatMap((row) =>
    series
      .map((item) => chartValue(row, item.key))
      .filter((value): value is number => value !== undefined),
  );
  const rawMax = Math.max(...numericValues, 1);
  const rawMin = Math.min(...numericValues, baselineZero ? 0 : 0);
  const roughRange = rawMax - rawMin || Math.max(Math.abs(rawMax), 100000);
  const tickStep = showYAxis
    ? Math.max(100000, Math.ceil(roughRange / 5 / 100000) * 100000)
    : 0;
  const min = showYAxis
    ? baselineZero
      ? 0
      : Math.floor((rawMin - tickStep * 0.5) / tickStep) * tickStep
    : rawMin;
  const max = showYAxis
    ? Math.max(min + tickStep, Math.ceil((rawMax + tickStep * 0.5) / tickStep) * tickStep)
    : rawMax;
  const range = Math.max(max - min, 1);
  const x = (index: number) => padLeft + index * xStep;
  const y = (value: number) =>
    padTop + (1 - (value - min) / range) * (plotBottom - padTop);
  const ticks = showYAxis
    ? Array.from(
        { length: Math.floor((max - min) / tickStep) + 1 },
        (_, index) => min + index * tickStep,
      )
    : [max, min + range / 2, min];

  const syncScrollLeft = () => {
    if (!wrapRef.current) return;
    setScrollLeft(wrapRef.current.scrollLeft);
  };

  const setChartZoom = (nextZoom: number, centerRatio = 0.5) => {
    const clamped = Math.min(4, Math.max(minZoomForFullView, nextZoom));
    const wrap = wrapRef.current;
    if (!wrap) {
      setZoom(clamped);
      return;
    }
    const previousZoom = zoom;
    const center = wrap.scrollLeft + wrap.clientWidth * centerRatio;
    const contentPoint = center / Math.max(previousZoom, 0.01);
    setZoom(clamped);
    window.requestAnimationFrame(() => {
      wrap.scrollLeft = Math.max(0, contentPoint * clamped - wrap.clientWidth * centerRatio);
      setScrollLeft(wrap.scrollLeft);
    });
  };

  const pinchDistance = (touches: { [index: number]: { clientX: number; clientY: number } }) => {
    const first = touches[0];
    const second = touches[1];
    return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
  };

  return (
    <div className="panel chart-panel">
      <div className="panel-head">
        <div className="panel-title">{title}</div>
      </div>
      <div className="panel-body">
        <div className={`chart-scroll-shell ${showYAxis ? "has-fixed-y-axis" : ""}`}>
          {showYAxis && (
            <svg
              className="fixed-y-axis-svg"
              viewBox={`0 0 ${axisWidth} ${height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <line
                x1={axisWidth - 1}
                y1={padTop}
                x2={axisWidth - 1}
                y2={plotBottom}
                className="chart-axis"
              />
              {ticks.map((tick) => {
                const gy = y(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={axisWidth - 6}
                      y1={gy}
                      x2={axisWidth - 1}
                      y2={gy}
                      className="chart-axis"
                    />
                    <text
                      x={axisWidth - 9}
                      y={gy + 5}
                      textAnchor="end"
                      className="chart-tick"
                    >
                      {Math.round(tick / 10000).toLocaleString("ja-JP")}万
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
          <div
            ref={wrapRef}
            className="line-chart-wrap fixed-chart-wrap"
            onScroll={syncScrollLeft}
            onWheel={(event) => {
              if (!event.ctrlKey && !event.metaKey) return;
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              const centerRatio = (event.clientX - rect.left) / Math.max(rect.width, 1);
              setChartZoom(zoom * (event.deltaY < 0 ? 1.12 : 0.88), centerRatio);
            }}
            onTouchStart={(event) => {
              if (event.touches.length !== 2) return;
              pinchRef.current = { distance: pinchDistance(event.touches), zoom };
            }}
            onTouchMove={(event) => {
              if (event.touches.length !== 2 || !pinchRef.current) return;
              event.preventDefault();
              const nextDistance = pinchDistance(event.touches);
              const rect = event.currentTarget.getBoundingClientRect();
              const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
              const centerRatio = (centerX - rect.left) / Math.max(rect.width, 1);
              setChartZoom(pinchRef.current.zoom * (nextDistance / pinchRef.current.distance), centerRatio);
            }}
            onTouchEnd={() => {
              pinchRef.current = null;
            }}
          >
            <svg
              className="line-chart"
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="xMinYMid meet"
              role="img"
            >
            <line
              x1={padLeft}
              y1={padTop}
              x2={padLeft}
              y2={plotBottom}
              className="chart-axis"
            />
            <line
              x1={padLeft}
              y1={plotBottom}
              x2={width - padRight}
              y2={plotBottom}
              className="chart-axis"
            />
            {ticks.map((tick) => {
              const gy = y(tick);
              return (
                <g key={tick}>
                  <line
                    x1={padLeft}
                    y1={gy}
                    x2={width - padRight}
                    y2={gy}
                    className="chart-grid"
                  />

                </g>
              );
            })}
            {series.map((item, sIndex) => {
              const points = rows
                .map((row, index) => {
                  const value = chartValue(row, item.key);
                  return value === undefined
                    ? undefined
                    : `${x(index)},${y(value)}`;
                })
                .filter((point): point is string => Boolean(point))
                .join(" ");
              return (
                <polyline
                  key={item.key}
                  points={points}
                  className={`line-series line-series-${item.colorIndex ?? sIndex % 6} ${item.dashed ? "line-series-dashed" : ""}`}
                />
              );
            })}
            {series.map((item, sIndex) =>
              rows.slice(visibleStart, visibleEnd).map((row, offset) => {
                const index = visibleStart + offset;
                const value = chartValue(row, item.key);
                if (value === undefined) return null;
                const cx = x(index);
                const cy = y(value);
                return (
                  <circle
                    key={`${item.key}-${String(row.label)}`}
                    cx={cx}
                    cy={cy}
                    r={Math.max(10, Math.min(18, xStep * 0.8))}
                    className="chart-hit-point"
                    onClick={() =>
                      setSelectedPoint({
                        label: String(row.label),
                        seriesLabel: item.label,
                        value,
                        x: cx,
                        y: cy,
                      })
                    }
                  />
                );
              }),
            )}
            {selectedPoint && (
              <g className="chart-point-popup">
                <rect
                  x={Math.min(Math.max(selectedPoint.x - 70, padLeft), width - padRight - 140)}
                  y={Math.max(selectedPoint.y - 58, padTop)}
                  width="140"
                  height="46"
                  rx="10"
                />
                <text
                  x={Math.min(Math.max(selectedPoint.x, padLeft + 70), width - padRight - 70)}
                  y={Math.max(selectedPoint.y - 39, padTop + 19)}
                  textAnchor="middle"
                >
                  {`${selectedPoint.label} ${selectedPoint.seriesLabel}`}
                </text>
                <text
                  x={Math.min(Math.max(selectedPoint.x, padLeft + 70), width - padRight - 70)}
                  y={Math.max(selectedPoint.y - 21, padTop + 37)}
                  textAnchor="middle"
                  className="chart-point-popup-value"
                >
                  {money(selectedPoint.value)}
                </text>
              </g>
            )}
            {rows.map((row, index) => {
              const label = String(row.label);
              const year = Number(label.slice(0, 4));
              const monthNumber = Number(label.slice(5, 7));
              const isYearStart = monthNumber === 1;
              const isQuarterStart = monthNumber === 1 || monthNumber === 4 || monthNumber === 7 || monthNumber === 10;
              const tickMode =
                xStep >= 34
                  ? "month"
                  : xStep >= 10
                    ? "quarter"
                    : xStep >= 1.2
                      ? "year"
                      : "threeYear";
              const shouldShowLabel =
                tickMode === "month"
                  ? true
                  : tickMode === "quarter"
                    ? isQuarterStart
                    : tickMode === "year"
                      ? isYearStart
                      : isYearStart && year % 3 === 0;
              const tickLabel =
                tickMode === "month"
                  ? isYearStart
                    ? `${year}`
                    : `${monthNumber}月`
                  : tickMode === "quarter"
                    ? isYearStart
                      ? `${year}`
                      : `${monthNumber}月`
                    : `${year}`;
              return (
                <g key={label}>
                  <line
                    x1={x(index)}
                    y1={plotBottom}
                    x2={x(index)}
                    y2={plotBottom + (isYearStart ? 9 : 5)}
                    className={
                      isYearStart ? "chart-year-mark" : "chart-month-mark"
                    }
                  />
                  {shouldShowLabel && (
                    <text
                      x={x(index)}
                      y={height - 12}
                      textAnchor="middle"
                      className="chart-tick"
                    >
                      {tickLabel}
                    </text>
                  )}
                </g>
              );
            })}
            </svg>
          </div>
        </div>
        <div className="chart-legend">
          {series
            .filter((item) => !item.hideLegend)
            .map((item, index) => (
              <span
                key={item.key}
                className={`legend-item line-series-${item.colorIndex ?? index % 6}`}
              >
                {item.label}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}

function AssetCards({ rows }: { rows: InvestmentRecord[] }) {
  return (
    <div className="asset-cards">
      {rows.map((row) => (
        <div className="asset-card" key={row.id}>
          <div className="asset-name">{row.account}</div>
          <div className="asset-value">{money(investmentValue(row))}</div>
          <div className="muted">元本 {money(row.capital)}</div>
        </div>
      ))}
    </div>
  );
}

function InvestmentSummary({ rows }: { rows: InvestmentRecord[] }) {
  return (
    <>
      <AssetCards rows={rows} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>口座</th>
              <th className="num">元本</th>
              <th className="num">予想</th>
              <th className="num">実績</th>
              <th className="num">損益</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.account}</td>
                <td className="num">{money(row.capital)}</td>
                <td className="num">{money(row.predicted_balance)}</td>
                <td className="num">{money(row.actual_balance)}</td>
                <td
                  className={`num ${investmentValue(row) - row.capital < 0 ? "negative" : "positive"}`}
                >
                  {money(investmentValue(row) - row.capital)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AllocationPanel({ rows }: { rows: InvestmentRecord[] }) {
  const total = Math.max(totalInvestments(rows), 1);
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">資産配分</div>
        <span className="badge">割合</span>
      </div>
      <div className="panel-body">
        <div className="allocation-list">
          {rows.map((row) => {
            const value = investmentValue(row);
            return (
              <div className="allocation-row" key={row.id}>
                <div className="allocation-top">
                  <span>{row.account}</span>
                  <b>{pct.format(value / total)}</b>
                </div>
                <div className="allocation-track">
                  <div
                    className="allocation-fill"
                    style={{ width: `${(value / total) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function buildInvestmentMonthlySeries(rows: InvestmentRecord[]) {
  const monthMap = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.month] = (acc[row.month] ?? 0) + investmentValue(row);
    return acc;
  }, {});
  return Object.entries(monthMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value }));
}

function buildInvestmentAccountSeries(
  rows: InvestmentRecord[],
  accounts: string[],
) {
  const months = Array.from(new Set(rows.map((row) => row.month))).sort(
    (a, b) => a.localeCompare(b),
  );
  return months.map((month) => {
    const item: Record<string, string | number> = { label: month };
    accounts.forEach((account) => {
      const row = rows.find(
        (entry) => entry.month === month && entry.account === account,
      );
      item[account] = row ? investmentValue(row) : 0;
    });
    return item;
  });
}

function MonthlyTable({
  rows,
  onSelect,
  onDelete,
}: {
  rows: MonthlyRecord[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [pendingDeleteRow, setPendingDeleteRow] = useState<MonthlyRecord | null>(null);
  const groupedRows = useMemo(() => {
    const groups = new Map<string, MonthlyRecord[]>();
    [...rows]
      .sort((a, b) => b.month.localeCompare(a.month))
      .forEach((row) => {
        const year = row.month.slice(0, 4);
        const current = groups.get(year) ?? [];
        current.push(row);
        groups.set(year, current);
      });
    return Array.from(groups.entries()).map(([year, items]) => ({ year, items }));
  }, [rows]);
  const [openYears, setOpenYears] = useState<Record<string, boolean>>(() => {
    const saved = readLocalStorage(SHORT_K_MONTHLY_OPEN_YEARS_STORAGE_KEY);
    if (!saved) return {};
    try {
      const parsed = JSON.parse(saved) as Record<string, boolean>;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return parsed;
    } catch {
      return {};
    }
  });

  const availableYearsKey = groupedRows.map(({ year }) => year).join("|");

  useEffect(() => {
    const availableYears = new Set(groupedRows.map(({ year }) => year));
    setOpenYears((current) => {
      const normalized = Object.fromEntries(
        Object.entries(current).filter(([year]) => availableYears.has(year)),
      ) as Record<string, boolean>;
      if (Object.keys(normalized).length !== Object.keys(current).length) {
        writeLocalStorage(
          SHORT_K_MONTHLY_OPEN_YEARS_STORAGE_KEY,
          JSON.stringify(normalized),
        );
        return normalized;
      }
      return current;
    });
  }, [availableYearsKey]);

  const updateOpenYears = (updater: (current: Record<string, boolean>) => Record<string, boolean>) => {
    setOpenYears((current) => {
      const next = updater(current);
      writeLocalStorage(SHORT_K_MONTHLY_OPEN_YEARS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const rowSummaries = useMemo(() => {
    const map = new Map<string, {
      deposit: number;
      income: number;
      outgo: number;
      investment: number;
      account: number;
    }>();
    groupedRows
      .filter(({ year }) => openYears[year])
      .flatMap(({ items }) => items)
      .forEach((row) => {
        const actuals = parseShortKActuals(row);
        map.set(row.id, {
          deposit: shortKCalculatedDeposit(row.month, rows),
          income: shortKIncomeTotal(actuals),
          outgo: shortKOutgoTotal(
            actuals,
            parseShortKActuals(rows.find((item) => item.month === previousMonth(row.month))),
          ),
          investment: shortKInvestmentTotal(actuals),
          account: actualAccount(row),
        });
      });
    return map;
  }, [groupedRows, openYears, rows]);

  return (
    <div className="panel monthly-table-panel">
      <div className="panel-head">
        <div className="panel-title">月次一覧</div>
      </div>
      <div className="year-accordion-list">
        {groupedRows.map(({ year, items }) => {
          const open = Boolean(openYears[year]);
          return (
            <section className="year-accordion" key={year}>
              <button
                type="button"
                className="year-accordion-head"
                onClick={() =>
                  updateOpenYears((current) => ({
                    ...current,
                    [year]: !current[year],
                  }))
                }
              >
                <span>{open ? "▼" : "▶"} {year}年</span>
                <span>{items.length}件</span>
              </button>
              {open && (
                <div className="table-wrap monthly-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>月</th>
                        <th className="num">現金</th>
                        <th className="num">収入</th>
                        <th className="num">支出</th>
                        <th className="num">投資</th>
                        <th className="num">口座・外貨</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row) => {
                        const summary = rowSummaries.get(row.id);
                        return (
                          <tr key={row.id}>
                            <td>
                              <button className="btn" onClick={() => onSelect(row.id)}>
                                {displayMonth(row.month)}
                              </button>
                            </td>
                            <td className="num">{money(summary?.deposit ?? 0)}</td>
                            <td className="num">{money(summary?.income ?? 0)}</td>
                            <td className="num negative">{money(summary?.outgo ?? 0)}</td>
                            <td className="num">{money(summary?.investment ?? 0)}</td>
                            <td className="num">{money(summary?.account ?? 0)}</td>
                            <td>
                              <button
                                className="btn danger"
                                onClick={() => setPendingDeleteRow(row)}
                              >
                                削除
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
      <ConfirmDialog
        config={
          pendingDeleteRow
            ? {
                title: "データを削除",
                message: `${displayMonth(pendingDeleteRow.month)}のデータを削除しますか？`,
                confirmLabel: "削除",
                onConfirm: () => onDelete(pendingDeleteRow.id),
              }
            : null
        }
        onClose={() => setPendingDeleteRow(null)}
      />
    </div>
  );
}

const MemoMonthlyTable = memo(MonthlyTable);

function LongPlanTable({
  rows,
  onSelect,
  onDelete,
  badge,
}: {
  rows: InvestmentRecord[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  badge: string;
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">{badge} 一覧</div>
        <span className="badge">そのまま集計</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>月</th>
              <th>シート</th>
              <th className="num">入金</th>
              <th className="num">出金</th>
              <th className="num">元本</th>
              <th className="num">予測残高</th>
              <th className="num">実績残高</th>
              <th className="num">差額</th>
              <th>メモ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[...rows]
              .sort((a, b) => b.month.localeCompare(a.month))
              .map((row) => {
                const value = investmentValue(row);
                return (
                  <tr key={row.id}>
                    <td>
                      <button className="btn" onClick={() => onSelect(row.id)}>
                        {row.month}
                      </button>
                    </td>
                    <td>{row.account}</td>
                    <td className="num">{money(row.deposit)}</td>
                    <td className="num">{money(row.withdrawal)}</td>
                    <td className="num">{money(row.capital)}</td>
                    <td className="num">{money(row.predicted_balance)}</td>
                    <td className="num">{money(row.actual_balance)}</td>
                    <td
                      className={`num ${value - row.capital < 0 ? "negative" : "positive"}`}
                    >
                      {money(value - row.capital)}
                    </td>
                    <td>{row.note}</td>
                    <td>
                      <button
                        className="btn danger"
                        onClick={() => onDelete(row.id)}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InvestmentTable({
  rows,
  onSelect,
  onDelete,
}: {
  rows: InvestmentRecord[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">積立一覧</div>
        <span className="badge">M23-30inv</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>月</th>
              <th>項目</th>
              <th className="num">入金</th>
              <th className="num">出金</th>
              <th className="num">元本</th>
              <th className="num">現在額</th>
              <th className="num">損益</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[...rows]
              .sort((a, b) => b.month.localeCompare(a.month))
              .map((row) => (
                <tr key={row.id}>
                  <td>
                    <button className="btn" onClick={() => onSelect(row.id)}>
                      {row.month}
                    </button>
                  </td>
                  <td>{row.account}</td>
                  <td className="num">{money(row.deposit)}</td>
                  <td className="num">{money(row.withdrawal)}</td>
                  <td className="num">{money(row.capital)}</td>
                  <td className="num">{money(investmentValue(row))}</td>
                  <td
                    className={`num ${investmentValue(row) - row.capital < 0 ? "negative" : "positive"}`}
                  >
                    {money(investmentValue(row) - row.capital)}
                  </td>
                  <td>
                    <button
                      className="btn danger"
                      onClick={() => onDelete(row.id)}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FundTable({
  rows,
  onSelect,
  onDelete,
}: {
  rows: FundRecord[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flat-panel asset-product-list">
      <div className="flat-panel-head">
        <div className="panel-title">保有商品</div>
      </div>
      <div className="asset-product-list-body">
        {rows.length === 0 ? (
          <div className="empty-state">商品がありません。</div>
        ) : (
          rows.map((row) => (
            <div className="asset-product-row" key={row.id}>
              <button className="asset-product-main" type="button" onClick={() => onSelect(row.id)}>
                <span className="asset-product-name">{row.name || "未設定"}</span>
                <span className="asset-product-value">{money(fundEvaluation(row))}</span>
              </button>
              <div className="asset-product-meta">
                <span>保有数 {yen.format(row.units)}</span>
                <span>基準価額 {yen.format(row.price)}</span>
              </div>
              <button className="btn danger" type="button" onClick={() => onDelete(row.id)}>削除</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TickerTable({
  rows,
  onSelect,
  onDelete,
}: {
  rows: TickerHolding[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flat-panel asset-product-list">
      <div className="flat-panel-head">
        <div className="panel-title">保有商品</div>
      </div>
      <div className="asset-product-list-body">
        {rows.length === 0 ? (
          <div className="empty-state">商品がありません。</div>
        ) : (
          rows.map((row) => (
            <div className="asset-product-row" key={row.id}>
              <button className="asset-product-main" type="button" onClick={() => onSelect(row.id)}>
                <span className="asset-product-name">{row.ticker || "未設定"}</span>
                <span className="asset-product-value">{money(tickerEvaluation(row))}</span>
              </button>
              <div className="asset-product-meta">
                <span>保有数 {formatCount(Math.max(1, n(row.shares)))}</span>
                <span>基準価額 {yen.format(row.price)}</span>
              </div>
              <button className="btn danger" type="button" onClick={() => onDelete(row.id)}>削除</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FxTable({
  rows,
  onSelect,
  onDelete,
}: {
  rows: FxTrade[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => b.date.localeCompare(a.date)),
    [rows],
  );
  const groups = useMemo(() => {
    const map = new Map<string, FxTrade[]>();
    sortedRows.forEach((row) => {
      const month = row.date.slice(0, 7) || "未設定";
      const current = map.get(month) ?? [];
      current.push(row);
      map.set(month, current);
    });
    return Array.from(map.entries()).map(([month, items]) => ({
      month,
      items,
      total: items.reduce((sum, row) => sum + n(row.result), 0),
    }));
  }, [sortedRows]);
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("finance.fx.openMonths");
      if (stored) setOpenMonths(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("finance.fx.openMonths", JSON.stringify(openMonths));
    } catch {}
  }, [openMonths]);


  const toggleMonth = (month: string) => {
    setOpenMonths((current) => ({ ...current, [month]: !current[month] }));
  };

  return (
    <div className="flat-panel fx-history-panel">
      <div className="flat-panel-head">
        <div className="panel-title">履歴</div>
      </div>
      <div className="fx-history-list">
        {groups.length === 0 ? (
          <div className="empty-state">履歴がありません。</div>
        ) : (
          groups.map((group) => {
            const open = openMonths[group.month] ?? false;
            return (
              <div className="fx-month-group" key={group.month}>
                <button className="fx-month-head" type="button" onClick={() => toggleMonth(group.month)}>
                  <span>{open ? "▼" : "▶"} {group.month}</span>
                  <b className={group.total < 0 ? "negative" : "positive"}>{signedMoney(group.total)}</b>
                </button>
                {open && (
                  <div className="fx-month-body">
                    {group.items.map((row) => (
                      <div className="fx-history-row" key={row.id}>
                        <button className="fx-history-main" type="button" onClick={() => onSelect(row.id)}>
                          <span>{row.date}</span>
                          <b className={row.result < 0 ? "negative" : "positive"}>{signedMoney(row.result)}</b>
                        </button>
                        <button className="btn danger" type="button" onClick={() => onDelete(row.id)}>削除</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
