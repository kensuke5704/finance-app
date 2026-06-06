"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  fundNames,
  investmentAccounts,
  newMonthlyRecord,
} from "../../lib/financeStore";
import type {
  FinanceState,
  FundRecord,
  FxRiskInput,
  FxTrade,
  InvestmentRecord,
  MonthlyRecord,
  TickerHolding,
} from "../../types/finance";
import {
  AllocationPanel,
  AssetCards,
  buildInvestmentAccountSeries,
  buildInvestmentMonthlySeries,
  FundTable,
  FxTable,
  InvestmentTable,
  LongPlanTable,
  TickerTable,
} from "./FinanceTables";
import {
  CollapsiblePanel,
  LineLikeChart,
  MemoMonthlyTable,
  MultiLineChart,
} from "./FinanceCharts";
import {
  actualCash,
  actualIncome,
  actualInvest,
  actualOutgo,
  fetchLatestMarketPrice,
  formatCount,
  formatMoneyInput,
  fundEvaluation,
  investmentValue,
  money,
  n,
  netAssets,
  parseMoneyInput,
  parsePlainNumberInput,
  pct,
  signedMoney,
  signedRate,
  tickerEvaluation,
  todayString,
  totalInvestments,
  uid,
} from "./financeUtils";
import type { ShortKActuals, ShortKBudget, ShortKAssetAccountKey } from "./FinanceShared";
import {
  SHORT_K_ACCOUNTS,
  SHORT_M_ACCOUNTS,
  SHORT_K_ASSET_ACCOUNTS,
  SHORT_K_BASE_CASH,
  SHORT_K_BASE_MONTH,
  SHORT_K_BUDGET_FALLBACK_MONTH,
  SHORT_K_BUDGETS,
  SHORT_K_CHART_TAB_STORAGE_KEY,
  SHORT_K_END,
  SHORT_K_INITIAL_INVESTMENT_PROFIT,
  SHORT_K_MONTHLY_OPEN_YEARS_STORAGE_KEY,
  SHORT_K_START,
  BudgetActualSummary,
  BudgetVarianceCard,
  ConfirmDialog,
  FormattedNumberInput,
  MoneyInput,
  MonthInput,
  NumberInput,
  ShortKInputSection,
  MemoBudgetActualSummary,
  MemoBudgetActualRow,
  TextInput,
  actualAccount,
  blankMonthly,
  buildShortKNote,
  buildShortKPredictionSeries,
  canCalculateShortKDeposit,
  currentMonthString,
  displayMonth,
  getShortKAssetRows,
  hasShortKActuals,
  inMonthRange,
  investmentsByAccounts,
  isShortKEntered,
  latestByMonth,
  latestEnteredShortKMonth,
  latestInvestmentRows,
  monthlyForMonth,
  monthlyRows,
  monthsBetween,
  nextMonth,
  parseShortKActuals,
  readLocalStorage,
  parseShortKBudgetOverrides,
  predictedAccount,
  previousMonth,
  shortKAccountDepositForMonth,
  shortKAccountEvaluation,
  shortKAccountMonthlyRate,
  shortKAccountPredictedValue,
  shortKAccountPrincipal,
  shortKActualDelta,
  shortKAdjustedAssetSummary,
  shortKAssetAccountAliases,
  shortKAssetActualSummary,
  shortKAssetRowMatches,
  shortKAssetSummary,
  shortKBudget,
  shortKBudgetDelta,
  shortKBudgetIncomeTotal,
  shortKBudgetInvestmentTotal,
  shortKCalculatedDeposit,
  shortKIncomeTotal,
  shortKInvestmentIncomeCumulative,
  shortKInvestmentTotal,
  shortKMonthOptions,
  shortKOutgoTotal,
  shortKProjectedBalance,
  shortKTotalInvestmentProfit,
  shortKYearOptions,
  writeLocalStorage,
} from "./FinanceShared";

export function ShortKAssetManagementView({
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

