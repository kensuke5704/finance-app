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
export { todayString, totalInvestments, uid } from "./financeUtils";


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
export {
  SHORT_K_ACCOUNTS,
  SHORT_M_ACCOUNTS,
  inMonthRange,
  investmentsByAccounts,
  latestByMonth,
  latestInvestmentRows,
  monthlyRows,
} from "./FinanceShared";
export function ShortKView({
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

export function MomentumView({
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
  addFund: (patch?: Partial<FundRecord>) => void;
  addTicker: (patch?: Partial<TickerHolding>) => void;
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
  const [addDialogOpen, setAddDialogOpen] = useState(false);

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

        <ProductAddDialog
          title="投資信託"
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          onSubmit={({ name, units, price }) => addFund({ name, units, price })}
        />

        {marketPriceStatus ? <div className="asset-price-status">{marketPriceStatus}</div> : null}
        <FundTable rows={state.funds} onSelect={setSelectedFundId} onDelete={deleteFund} onAdd={() => setAddDialogOpen(true)} />
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

      <ProductAddDialog
        title="アクティブ"
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSubmit={({ name, units, price }) => addTicker({ ticker: name, shares: Math.max(1, units), price })}
      />

      {marketPriceStatus ? <div className="asset-price-status">{marketPriceStatus}</div> : null}
      <TickerTable rows={state.tickers} onSelect={setSelectedTickerId} onDelete={deleteTicker} onAdd={() => setAddDialogOpen(true)} />
    </section>
  );
}


function addDays(dateString: string, diff: number) {
  const base = dateString ? new Date(`${dateString}T00:00:00`) : new Date();
  base.setDate(base.getDate() + diff);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}

function daysInMonth(year: string, month: string) {
  const y = Number(year);
  const m = Number(month);
  if (!y || !m) return 31;
  return new Date(y, m, 0).getDate();
}

function yearOptionsForFx() {
  const current = new Date().getFullYear();
  const years: string[] = [];
  for (let year = current - 5; year <= current + 5; year += 1) years.push(String(year));
  return years;
}

function ProductAddDialog({
  title,
  open,
  onClose,
  onSubmit,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  onSubmit: (values: { name: string; units: number; price: number }) => void;
}) {
  const [name, setName] = useState("");
  const [units, setUnits] = useState(1);
  const [price, setPrice] = useState(0);

  useEffect(() => {
    if (!open) return;
    setName("");
    setUnits(1);
    setPrice(0);
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card product-add-modal">
        <div className="modal-title">{title}を追加</div>
        <div className="product-add-form">
          <label className="field">
            <span className="label">商品名</span>
            <TextInput value={name} onChange={setName} placeholder="商品名・コード" />
          </label>
          <label className="field">
            <span className="label">保有数</span>
            <FormattedNumberInput value={units} onChange={setUnits} />
          </label>
          <label className="field">
            <span className="label">基準価額</span>
            <FormattedNumberInput value={price} onChange={setPrice} />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>キャンセル</button>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              onSubmit({ name: name.trim(), units: Math.max(0, units), price });
              onClose();
            }}
          >
            追加
          </button>
        </div>
      </div>
    </div>
  );
}

export function FxView({
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
              <div className="month-picker-row fx-date-picker-row">
                <button className="month-arrow" type="button" onClick={() => setRecordDate(addDays(recordDate, -1))} aria-label="前の日">←</button>
                <div className="fx-date-select-grid">
                  <label className="field">
                    <span className="label">年</span>
                    <select
                      className="input editable-input"
                      value={(recordDate || todayString()).slice(0, 4)}
                      onChange={(event) => {
                        const month = (recordDate || todayString()).slice(5, 7);
                        const day = Math.min(Number((recordDate || todayString()).slice(8, 10)), daysInMonth(event.target.value, month));
                        setRecordDate(`${event.target.value}-${month}-${String(day).padStart(2, "0")}`);
                      }}
                    >
                      {yearOptionsForFx().map((year) => (
                        <option key={year} value={year}>{year}年</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="label">月</span>
                    <select
                      className="input editable-input"
                      value={(recordDate || todayString()).slice(5, 7)}
                      onChange={(event) => {
                        const year = (recordDate || todayString()).slice(0, 4);
                        const day = Math.min(Number((recordDate || todayString()).slice(8, 10)), daysInMonth(year, event.target.value));
                        setRecordDate(`${year}-${event.target.value}-${String(day).padStart(2, "0")}`);
                      }}
                    >
                      {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((month) => (
                        <option key={month} value={month}>{Number(month)}月</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="label">日</span>
                    <select
                      className="input editable-input"
                      value={(recordDate || todayString()).slice(8, 10)}
                      onChange={(event) => {
                        const base = recordDate || todayString();
                        setRecordDate(`${base.slice(0, 4)}-${base.slice(5, 7)}-${event.target.value}`);
                      }}
                    >
                      {Array.from({ length: daysInMonth((recordDate || todayString()).slice(0, 4), (recordDate || todayString()).slice(5, 7)) }, (_, index) => String(index + 1).padStart(2, "0")).map((day) => (
                        <option key={day} value={day}>{Number(day)}日</option>
                      ))}
                    </select>
                  </label>
                </div>
                <button className="month-arrow" type="button" onClick={() => setRecordDate(addDays(recordDate, 1))} aria-label="次の日">→</button>
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

