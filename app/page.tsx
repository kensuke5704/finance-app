"use client";

import { useEffect, useRef, useState } from "react";
import LoginGate from "../components/LoginGate";
import {
  defaultState,
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
import {
  BudgetSettingsView,
  FxView,
  MomentumView,
  SHORT_K_ACCOUNTS,
  ShortKAssetManagementView,
  ShortKView,
  inMonthRange,
  investmentsByAccounts,
  latestByMonth,
  latestInvestmentRows,
  monthlyRows,
  todayString,
  totalInvestments,
  uid,
} from "../components/finance/FinanceViews";

type MainTab = "short" | "asset" | "budget";
type AssetInnerTab = "asset" | "fund" | "active" | "fx";

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
                  addFund={(patch) => {
                    const row = { ...newFundRecord(), id: uid(), ...patch };
                    setState((prev) => ({ ...prev, funds: [row, ...prev.funds] }));
                    setSelectedFundId(row.id);
                  }}
                  addTicker={(patch) => {
                    const row = { ...newTickerHolding(), id: uid(), shares: 1, ...patch };
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

