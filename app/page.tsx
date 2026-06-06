"use client";

import { useEffect, useRef, useState } from "react";
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

type MainTab = "short" | "long" | "momentum" | "fx";
type PairTab = "K" | "M";

const yen = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("ja-JP", {
  style: "percent",
  maximumFractionDigits: 2,
});
const SHORT_K_ACCOUNTS = ["WealthNavi", "ROBOPRO", "INDEX", "Active"];
const SHORT_M_ACCOUNTS = ["Cash", "WealthNavi", "NASDAQ100", "NISA"];
const LONG_K_ACCOUNTS = ["K30-60gen"];
const LONG_M_ACCOUNTS = ["M30-60gen"];

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

function MoneyInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(formatMoneyInput(value));

  useEffect(() => {
    if (!focused) setDraft(formatMoneyInput(value));
  }, [value, focused]);

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
          setFocused(false);
          setDraft(formatMoneyInput(value));
        }}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          onChange(parseMoneyInput(next));
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
  const [shortTab, setShortTab] = useState<PairTab>("K");
  const [longTab, setLongTab] = useState<PairTab>("K");
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
    const timer = window.setTimeout(() => {
      save(state, true);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [state, loading]);

  async function save(nextState = state, silent = false) {
    setSaving(true);
    setMessage("");
    try {
      await persistFinanceState(nextState);
      if (!silent) setMessage("保存しました");
    } catch (error) {
      setMessage(
        `保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setSaving(false);
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
      tickers: prev.tickers.map((item) => (item.id === row.id ? row : item)),
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
  const shortMRows = investmentsByAccounts(state.investments, SHORT_M_ACCOUNTS);
  const latestMonthly = latestByMonth(state.monthly);
  const sortedMonthly = monthlyRows(state.monthly);
  const shortKDetailRows = latestInvestmentRows(shortKRows);
  const shortMDetailRows = latestInvestmentRows(shortMRows);
  const shortKInvestmentTotal = totalInvestments(shortKDetailRows);
  const shortMInvestmentTotal = totalInvestments(shortMDetailRows);
  const longKRows = investmentsByAccounts(state.investments, LONG_K_ACCOUNTS);
  const longMRows = investmentsByAccounts(state.investments, LONG_M_ACCOUNTS);

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
              ["short", "短期"],
              ["long", "長期"],
              ["momentum", "モメンタム"],
              ["fx", "FX"],
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

          {mainTab === "short" && (
            <>
              <nav className="subtabs">
                <button
                  className={`subtab ${shortTab === "K" ? "active" : ""}`}
                  onClick={() => setShortTab("K")}
                >
                  K
                </button>
                <button
                  className={`subtab ${shortTab === "M" ? "active" : ""}`}
                  onClick={() => setShortTab("M")}
                >
                  M
                </button>
              </nav>
              {shortTab === "K" && selectedMonthly && (
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
                  detailRows={shortKRows}
                  upsertInvestment={upsertShortKInvestment}
                />
              )}
              {shortTab === "M" && (
                <ShortMView
                  rows={shortMRows}
                  detailRows={shortMDetailRows}
                  selectedInvestment={selectedInvestment}
                  selectedInvestmentId={selectedInvestmentId}
                  setSelectedInvestmentId={setSelectedInvestmentId}
                  updateInvestment={updateInvestment}
                  addInvestment={() => {
                    const row = {
                      ...newInvestmentRecord(),
                      id: uid(),
                      account: "NISA",
                    };
                    setState((prev) => ({
                      ...prev,
                      investments: [row, ...prev.investments],
                    }));
                    setSelectedInvestmentId(row.id);
                  }}
                  deleteInvestment={(id) =>
                    setState((prev) => ({
                      ...prev,
                      investments: prev.investments.filter(
                        (row) => row.id !== id,
                      ),
                    }))
                  }
                  inputOpen={inputOpen}
                  setInputOpen={setInputOpen}
                />
              )}
            </>
          )}

          {mainTab === "long" && (
            <>
              <nav className="subtabs">
                <button
                  className={`subtab ${longTab === "K" ? "active" : ""}`}
                  onClick={() => setLongTab("K")}
                >
                  K
                </button>
                <button
                  className={`subtab ${longTab === "M" ? "active" : ""}`}
                  onClick={() => setLongTab("M")}
                >
                  M
                </button>
              </nav>
              <LongPlanView
                title={longTab === "K" ? "長期K" : "長期M"}
                badge={longTab === "K" ? "K30-60gen" : "M30-60gen"}
                rows={longTab === "K" ? longKRows : longMRows}
                accountOptions={
                  longTab === "K" ? LONG_K_ACCOUNTS : LONG_M_ACCOUNTS
                }
                selectedInvestmentId={selectedInvestmentId}
                setSelectedInvestmentId={setSelectedInvestmentId}
                updateInvestment={updateInvestment}
                addInvestment={() => {
                  const row = {
                    ...newInvestmentRecord(),
                    id: uid(),
                    account: longTab === "K" ? "K30-60gen" : "M30-60gen",
                  };
                  setState((prev) => ({
                    ...prev,
                    investments: [row, ...prev.investments],
                  }));
                  setSelectedInvestmentId(row.id);
                }}
                deleteInvestment={(id) =>
                  setState((prev) => ({
                    ...prev,
                    investments: prev.investments.filter(
                      (row) => row.id !== id,
                    ),
                  }))
                }
              />
            </>
          )}

          {mainTab === "momentum" && selectedFund && selectedTicker && (
            <MomentumView
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
                const row = { ...newTickerHolding(), id: uid() };
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

          {mainTab === "fx" && selectedFx && (
            <FxView
              rows={state.fxTrades}
              selectedFx={selectedFx}
              selectedFxId={selectedFxId}
              setSelectedFxId={setSelectedFxId}
              updateFx={updateFx}
              addFx={() => {
                const row = { ...newFxTrade(), id: uid() };
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
        </div>
      </main>
    </LoginGate>
  );
}

const SHORT_K_START = "2024-09";
const SHORT_K_END = "2031-06";
const SHORT_K_BASE_MONTH = "2024-08";
const SHORT_K_BASE_CASH = 2359881;

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
    return {
      incomeCashBudget:
        values.incomeCashBudget === undefined
          ? undefined
          : n(values.incomeCashBudget),
      incomeInvestmentBudget:
        values.incomeInvestmentBudget === undefined
          ? undefined
          : n(values.incomeInvestmentBudget),
      outgoBudget:
        values.outgoBudget === undefined ? undefined : n(values.outgoBudget),
      fundInvestmentBudget:
        values.fundInvestmentBudget === undefined
          ? undefined
          : n(values.fundInvestmentBudget),
      activeInvestmentBudget:
        values.activeInvestmentBudget === undefined
          ? undefined
          : n(values.activeInvestmentBudget),
      usdInvestmentBudget:
        values.usdInvestmentBudget === undefined
          ? undefined
          : n(values.usdInvestmentBudget),
    };
  } catch {
    return {};
  }
}

function shortKBudget(month: string, row?: MonthlyRecord): ShortKBudget {
  const base = SHORT_K_BUDGETS[month] ?? {
    cashPrediction: row?.cash_prediction ?? 0,
    incomeCashBudget: row?.income_budget ?? 0,
    incomeInvestmentBudget: 0,
    outgoBudget: row?.outgo_budget ?? 0,
    fundInvestmentBudget: row?.invest_budget ?? 0,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
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

function buildShortKPredictionSeries(sortedRows: MonthlyRecord[]) {
  const allMonths = monthsBetween(SHORT_K_START, SHORT_K_END);
  const latestEnteredMonth = latestEnteredShortKMonth(sortedRows);

  return allMonths.map((month) => {
    const row = sortedRows.find((item) => item.month === month);
    const actuals = parseShortKActuals(row);
    const isEntered = Boolean(row && hasShortKActuals(actuals));
    const actualBalance = isEntered
      ? shortKCalculatedDeposit(month, sortedRows)
      : undefined;
    const projectedBalance = latestEnteredMonth
      ? month === latestEnteredMonth
        ? shortKCalculatedDeposit(latestEnteredMonth, sortedRows)
        : month > latestEnteredMonth
          ? shortKProjectedBalance(month, sortedRows, latestEnteredMonth)
          : undefined
      : shortKProjectedBalance(month, sortedRows, undefined);

    return {
      label: month,
      cashActual: actualBalance,
      cashPrediction: projectedBalance,
      assetActual:
        actualBalance !== undefined ? actualBalance + 1000000 : undefined,
      assetPrediction:
        projectedBalance !== undefined ? projectedBalance + 1000000 : undefined,
      cumulativeProfit: -5371418,
    };
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
          <MoneyInput value={actual} onChange={onChange} />
        </label>
      </div>
    </div>
  );
}

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

function BudgetVarianceCard({ value }: { value: number }) {
  return (
    <div className="result-card">
      <span>対予算</span>
      <b className={value < 0 ? "negative" : "positive"}>
        {signedMoney(value)}
      </b>
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
  const [shortKChartTab, setShortKChartTab] = useState<"cash" | "profit">(
    "cash",
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
  const enteredRows = sortedRows.filter(
    (row) => inMonthRange(row.month) && isShortKEntered(row),
  );
  const shortKSeries = buildShortKPredictionSeries(sortedRows);
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
            現金予測
          </button>
          <button
            className={`chart-tab ${shortKChartTab === "profit" ? "active" : ""}`}
            onClick={() => setShortKChartTab("profit")}
          >
            通算損益
          </button>
        </div>
        {shortKChartTab === "cash" ? (
          <MultiLineChart
            title="現金予測"
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
          />
        ) : (
          <MultiLineChart
            title="通算損益"
            rows={shortKSeries}
            series={[{ key: "cumulativeProfit", label: "通算損益" }]}
            showYAxis
          />
        )}
      </div>

      <section className="grid short-k-layout">
        <div className="panel">
          <div className="panel-head compact-head">
            <div className="panel-title">実績入力</div>
          </div>
          <div className="panel-body">
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
                    <BudgetActualSummary
                      label="収入合計"
                      budget={incomeBudgetTotal}
                      actual={incomeTotal}
                      compact
                    />
                  }
                  open={openInputSections.income}
                  onToggle={() => toggleInputSection("income")}
                >
                  <BudgetActualRow
                    label="現金収入"
                    budget={selectedBudget.incomeCashBudget}
                    actual={selectedActuals.incomeCash}
                    onChange={(value) => updateActual("incomeCash", value)}
                  />
                  <BudgetActualRow
                    label="投資収入"
                    budget={selectedBudget.incomeInvestmentBudget}
                    actual={selectedActuals.incomeInvestment}
                    onChange={(value) =>
                      updateActual("incomeInvestment", value)
                    }
                  />
                  <BudgetActualSummary
                    label="収入合計"
                    budget={incomeBudgetTotal}
                    actual={incomeTotal}
                  />
                </ShortKInputSection>

                <ShortKInputSection
                  title="支出"
                  summary={
                    <BudgetActualSummary
                      label="支出合計"
                      budget={selectedBudget.outgoBudget}
                      actual={outgoTotal}
                      compact
                    />
                  }
                  open={openInputSections.outgo}
                  onToggle={() => toggleInputSection("outgo")}
                >
                  <BudgetActualRow
                    label="現金支出"
                    budget={null}
                    actual={selectedActuals.outgoCash}
                    onChange={(value) => updateActual("outgoCash", value)}
                  />
                  <BudgetActualRow
                    label="PayPay等支出"
                    budget={null}
                    actual={selectedActuals.outgoPaypay}
                    onChange={(value) => updateActual("outgoPaypay", value)}
                  />
                  <BudgetActualRow
                    label="クレジットカード支出"
                    budget={null}
                    actual={selectedActuals.outgoCard}
                    onChange={(value) => updateActual("outgoCard", value)}
                  />
                  <BudgetActualSummary
                    label="支出合計"
                    budget={selectedBudget.outgoBudget}
                    actual={outgoTotal}
                  />
                </ShortKInputSection>

                <ShortKInputSection
                  title="投資"
                  summary={
                    <BudgetActualSummary
                      label="投資合計"
                      budget={investmentBudgetTotal}
                      actual={investmentTotal}
                      compact
                    />
                  }
                  open={openInputSections.investment}
                  onToggle={() => toggleInputSection("investment")}
                >
                  <BudgetActualRow
                    label="投資信託"
                    budget={selectedBudget.fundInvestmentBudget}
                    actual={selectedActuals.fundInvestment}
                    onChange={(value) => updateActual("fundInvestment", value)}
                  />
                  <BudgetActualRow
                    label="アクティブ"
                    budget={selectedBudget.activeInvestmentBudget}
                    actual={selectedActuals.activeInvestment}
                    onChange={(value) =>
                      updateActual("activeInvestment", value)
                    }
                  />
                  <BudgetActualRow
                    label="USD"
                    budget={selectedBudget.usdInvestmentBudget}
                    actual={selectedActuals.usdInvestment}
                    onChange={(value) => updateActual("usdInvestment", value)}
                  />
                  <BudgetActualSummary
                    label="投資合計"
                    budget={investmentBudgetTotal}
                    actual={investmentTotal}
                  />
                </ShortKInputSection>

                <BudgetVarianceCard value={budgetVariance} />
                <div className="result-card deposit">
                  <span>預金残高</span>
                  <b>
                    {calculatedDeposit === undefined
                      ? "—"
                      : money(calculatedDeposit)}
                  </b>
                </div>
              </div>
            )}
          </div>
        </div>

        <MonthlyTable
          rows={enteredRows}
          onSelect={(id) => {
            const row = rows.find((item) => item.id === id);
            if (row) setSelectedMonth(row.month);
          }}
          onDelete={deleteMonthly}
        />
      </section>
    </section>
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

function MomentumView({
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
  return (
    <section className="grid">
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">モメンタム / funds</div>
          <button className="btn" onClick={addFund}>
            追加
          </button>
        </div>
        <div className="panel-body">
          <div className="field">
            <span className="label">編集行</span>
            <select
              className="input"
              value={selectedFundId}
              onChange={(e) => setSelectedFundId(e.target.value)}
            >
              {state.funds.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.date} / {row.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="label">日付</span>
            <input
              className="input"
              type="date"
              value={selectedFund.date}
              onChange={(e) =>
                updateFund({ ...selectedFund, date: e.target.value })
              }
            />
          </div>
          <div className="field">
            <span className="label">ファンド名</span>
            <select
              className="input"
              value={selectedFund.name}
              onChange={(e) =>
                updateFund({ ...selectedFund, name: e.target.value })
              }
            >
              {fundNames.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </div>
          <div className="form-grid">
            <div className="field">
              <span className="label">基準価額</span>
              <NumberInput
                value={selectedFund.price}
                onChange={(price) => updateFund({ ...selectedFund, price })}
              />
            </div>
            <div className="field">
              <span className="label">前日差</span>
              <NumberInput
                value={selectedFund.change_amount}
                onChange={(change_amount) =>
                  updateFund({ ...selectedFund, change_amount })
                }
              />
            </div>
            <div className="field">
              <span className="label">純資産 百万円</span>
              <NumberInput
                value={selectedFund.nav_million}
                onChange={(nav_million) =>
                  updateFund({ ...selectedFund, nav_million })
                }
              />
            </div>
            <div className="field">
              <span className="label">保有数</span>
              <NumberInput
                value={selectedFund.units}
                onChange={(units) => updateFund({ ...selectedFund, units })}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="stack">
        <FundTable
          rows={state.funds}
          onSelect={setSelectedFundId}
          onDelete={deleteFund}
        />
        <div className="grid" style={{ gridTemplateColumns: "300px 1fr" }}>
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">個別銘柄</div>
              <button className="btn" onClick={addTicker}>
                追加
              </button>
            </div>
            <div className="panel-body">
              <div className="field">
                <span className="label">編集行</span>
                <select
                  className="input"
                  value={selectedTickerId}
                  onChange={(e) => setSelectedTickerId(e.target.value)}
                >
                  {state.tickers.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.ticker || "未設定"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <span className="label">Ticker</span>
                <TextInput
                  value={selectedTicker.ticker}
                  onChange={(ticker) =>
                    updateTicker({
                      ...selectedTicker,
                      ticker: ticker.toUpperCase(),
                    })
                  }
                />
              </div>
              <div className="field">
                <span className="label">終値</span>
                <NumberInput
                  value={selectedTicker.price}
                  onChange={(price) =>
                    updateTicker({ ...selectedTicker, price })
                  }
                />
              </div>
              <div className="field">
                <span className="label">保有数</span>
                <NumberInput
                  value={selectedTicker.shares}
                  onChange={(shares) =>
                    updateTicker({ ...selectedTicker, shares })
                  }
                />
              </div>
            </div>
          </div>
          <TickerTable
            rows={state.tickers}
            onSelect={setSelectedTickerId}
            onDelete={deleteTicker}
          />
        </div>
      </div>
    </section>
  );
}

function FxView({
  rows,
  selectedFx,
  selectedFxId,
  setSelectedFxId,
  updateFx,
  addFx,
  deleteFx,
  risk,
  updateRisk,
  floatingLoss,
  requiredMargin,
  shortage,
  losscutRate,
}: {
  rows: FxTrade[];
  selectedFx: FxTrade;
  selectedFxId: string;
  setSelectedFxId: (id: string) => void;
  updateFx: (row: FxTrade) => void;
  addFx: () => void;
  deleteFx: (id: string) => void;
  risk: FxRiskInput;
  updateRisk: (row: FxRiskInput) => void;
  floatingLoss: number;
  requiredMargin: number;
  shortage: number;
  losscutRate: number;
}) {
  return (
    <section className="grid">
      <div className="stack">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">FX損益入力</div>
            <button className="btn" onClick={addFx}>
              追加
            </button>
          </div>
          <div className="panel-body">
            <div className="field">
              <span className="label">編集行</span>
              <select
                className="input"
                value={selectedFxId}
                onChange={(e) => setSelectedFxId(e.target.value)}
              >
                {rows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.date} / {money(row.result)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <span className="label">日付</span>
              <input
                className="input"
                type="date"
                value={selectedFx.date}
                onChange={(e) =>
                  updateFx({ ...selectedFx, date: e.target.value })
                }
              />
            </div>
            <div className="field">
              <span className="label">損益</span>
              <NumberInput
                value={selectedFx.result}
                onChange={(result) => updateFx({ ...selectedFx, result })}
              />
            </div>
            <div className="field">
              <span className="label">メモ</span>
              <TextInput
                value={selectedFx.memo ?? ""}
                onChange={(memo) => updateFx({ ...selectedFx, memo })}
              />
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">ロスカット条件</div>
            <span className="badge">loss</span>
          </div>
          <div className="panel-body">
            <div className="form-grid">
              <div className="field">
                <span className="label">保証金</span>
                <NumberInput
                  value={risk.margin}
                  onChange={(margin) => updateRisk({ ...risk, margin })}
                />
              </div>
              <div className="field">
                <span className="label">通貨数</span>
                <NumberInput
                  value={risk.units}
                  onChange={(units) => updateRisk({ ...risk, units })}
                />
              </div>
              <div className="field">
                <span className="label">約定価格</span>
                <NumberInput
                  value={risk.contract_rate}
                  onChange={(contract_rate) =>
                    updateRisk({ ...risk, contract_rate })
                  }
                />
              </div>
              <div className="field">
                <span className="label">現在レート</span>
                <NumberInput
                  value={risk.current_rate}
                  onChange={(current_rate) =>
                    updateRisk({ ...risk, current_rate })
                  }
                />
              </div>
              <div className="field">
                <span className="label">レバレッジ</span>
                <NumberInput
                  value={risk.leverage}
                  onChange={(leverage) => updateRisk({ ...risk, leverage })}
                />
              </div>
              <div className="field">
                <span className="label">swap単位</span>
                <NumberInput
                  value={risk.swap_per_unit}
                  onChange={(swap_per_unit) =>
                    updateRisk({ ...risk, swap_per_unit })
                  }
                />
              </div>
              <div className="field">
                <span className="label">保有日数</span>
                <NumberInput
                  value={risk.holding_days}
                  onChange={(holding_days) =>
                    updateRisk({ ...risk, holding_days })
                  }
                />
              </div>
              <div className="field">
                <span className="label">追加保証金</span>
                <NumberInput
                  value={risk.extra_margin}
                  onChange={(extra_margin) =>
                    updateRisk({ ...risk, extra_margin })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="stack">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">計算結果</div>
            <span className="badge">loss</span>
          </div>
          <div className="panel-body">
            <section className="kpis mini">
              <div className="kpi">
                <div className="kpi-label">含み損益</div>
                <div
                  className={`kpi-value ${floatingLoss < 0 ? "negative" : "positive"}`}
                >
                  {money(floatingLoss)}
                </div>
              </div>
              <div className="kpi">
                <div className="kpi-label">必要保証金</div>
                <div className="kpi-value">{money(requiredMargin)}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">不足保証金</div>
                <div
                  className={`kpi-value ${shortage > 0 ? "negative" : "positive"}`}
                >
                  {money(shortage)}
                </div>
              </div>
              <div className="kpi">
                <div className="kpi-label">概算ロスカット水準</div>
                <div className="kpi-value">{losscutRate.toFixed(3)}</div>
              </div>
            </section>
          </div>
        </div>
        <FxTable rows={rows} onSelect={setSelectedFxId} onDelete={deleteFx} />
      </div>
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
}) {
  const chartValue = (
    row: Record<string, string | number | undefined>,
    key: string,
  ) => {
    const value = row[key];
    return typeof value === "number" && Number.isFinite(value)
      ? value
      : undefined;
  };
  const numericValues = rows.flatMap((row) =>
    series
      .map((item) => chartValue(row, item.key))
      .filter((value): value is number => value !== undefined),
  );
  const rawMax = Math.max(...numericValues, 1);
  const rawMin = Math.min(...numericValues, 0);
  const tickStep = showYAxis
    ? Math.max(
        100000,
        Math.ceil((rawMax - rawMin || 100000) / 5 / 100000) * 100000,
      )
    : 0;
  const min = showYAxis
    ? baselineZero
      ? 0
      : Math.floor(rawMin / 100000) * 100000
    : rawMin;
  const max = showYAxis
    ? Math.max(min + tickStep, Math.ceil(rawMax / 100000) * 100000)
    : rawMax;
  const range = Math.max(max - min, 1);
  const width = showYAxis ? 390 : 390;
  const height = showYAxis ? 310 : 310;
  const padLeft = showYAxis ? 54 : 32;
  const padRight = showYAxis ? 10 : 10;
  const padY = 18;
  const plotBottom = height - padY - 34;
  const x = (index: number) =>
    padLeft +
    (rows.length <= 1
      ? 0
      : (index / (rows.length - 1)) * (width - padLeft - padRight));
  const y = (value: number) =>
    padY + (1 - (value - min) / range) * (plotBottom - padY);
  const ticks = showYAxis
    ? Array.from(
        { length: Math.floor((max - min) / tickStep) + 1 },
        (_, index) => min + index * tickStep,
      )
    : [max, min + range / 2, min];

  return (
    <div className="panel chart-panel">
      <div className="panel-head">
        <div className="panel-title">{title}</div>
      </div>
      <div className="panel-body">
        <div className="line-chart-wrap fixed-chart-wrap">
          <svg
            className="line-chart"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
          >
            <line
              x1={padLeft}
              y1={padY}
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
                  {showYAxis && (
                    <text
                      x={padLeft - 8}
                      y={gy + 6}
                      textAnchor="end"
                      className="chart-tick"
                    >
                      {yen.format(Math.round(tick / 10000))}万
                    </text>
                  )}
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
            {rows.map((row, index) => {
              const label = String(row.label);
              const month = label.slice(5, 7);
              const isYearStart = month === "01";
              const shouldShowYear = isYearStart && !label.startsWith("2024");
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
                  {shouldShowYear && (
                    <text
                      x={x(index)}
                      y={height - 12}
                      textAnchor="middle"
                      className="chart-tick"
                    >
                      {label.slice(0, 4)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
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
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">月次一覧</div>
      </div>
      <div className="table-wrap">
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
            {[...rows]
              .sort((a, b) => b.month.localeCompare(a.month))
              .map((row) => (
                <tr key={row.id}>
                  <td>
                    <button className="btn" onClick={() => onSelect(row.id)}>
                      {displayMonth(row.month)}
                    </button>
                  </td>
                  <td className="num">
                    {money(shortKCalculatedDeposit(row.month, rows))}
                  </td>
                  <td className="num">
                    {money(shortKIncomeTotal(parseShortKActuals(row)))}
                  </td>
                  <td className="num negative">
                    {money(
                      shortKOutgoTotal(
                        parseShortKActuals(row),
                        parseShortKActuals(
                          rows.find(
                            (item) => item.month === previousMonth(row.month),
                          ),
                        ),
                      ),
                    )}
                  </td>
                  <td className="num">
                    {money(shortKInvestmentTotal(parseShortKActuals(row)))}
                  </td>
                  <td className="num">{money(actualAccount(row))}</td>
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
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">funds一覧</div>
        <span className="badge">モメンタム</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>日付</th>
              <th>ファンド</th>
              <th className="num">基準価額</th>
              <th className="num">前日差</th>
              <th className="num">純資産</th>
              <th className="num">保有数</th>
              <th className="num">評価額</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <button className="btn" onClick={() => onSelect(row.id)}>
                    {row.date}
                  </button>
                </td>
                <td>{row.name}</td>
                <td className="num">{yen.format(row.price)}</td>
                <td
                  className={`num ${row.change_amount < 0 ? "negative" : "positive"}`}
                >
                  {yen.format(row.change_amount)}
                </td>
                <td className="num">{yen.format(row.nav_million)}</td>
                <td className="num">{yen.format(row.units)}</td>
                <td className="num">
                  {money((row.price * row.units) / 10000)}
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
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">個別銘柄一覧</div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th className="num">終値</th>
              <th className="num">保有数</th>
              <th className="num">総額</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <button className="btn" onClick={() => onSelect(row.id)}>
                    {row.ticker || "未設定"}
                  </button>
                </td>
                <td className="num">{yen.format(row.price)}</td>
                <td className="num">{yen.format(row.shares)}</td>
                <td className="num">{money(row.price * row.shares)}</td>
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

function FxTable({
  rows,
  onSelect,
  onDelete,
}: {
  rows: FxTrade[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const monthMap = rows.reduce<Record<string, number>>((acc, row) => {
    const month = row.date.slice(0, 7);
    acc[month] = (acc[month] ?? 0) + row.result;
    return acc;
  }, {});
  return (
    <div className="two-col">
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">FX履歴</div>
          <span className="badge">FX</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>日付</th>
                <th className="num">損益</th>
                <th>メモ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <button className="btn" onClick={() => onSelect(row.id)}>
                      {row.date}
                    </button>
                  </td>
                  <td
                    className={`num ${row.result < 0 ? "negative" : "positive"}`}
                  >
                    {money(row.result)}
                  </td>
                  <td>{row.memo}</td>
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
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">月別集計</div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>月</th>
                <th className="num">合計</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(monthMap)
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([month, total]) => (
                  <tr key={month}>
                    <td>{month}</td>
                    <td
                      className={`num ${total < 0 ? "negative" : "positive"}`}
                    >
                      {money(total)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
