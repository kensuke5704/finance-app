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

export function BudgetSettingsView({
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
