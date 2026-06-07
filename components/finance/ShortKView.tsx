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
import type { ShortKActuals, ShortKBudget, ShortKAssetAccountKey, ShortKAnnualReturnRates } from "./FinanceShared";
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

export function ShortKView({
  rows,
  sortedRows,
  selectedMonth,
  setSelectedMonth,
  upsertMonthly,
  deleteMonthly,
  detailRows,
  upsertInvestment,
  annualReturnRates,
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
  annualReturnRates: ShortKAnnualReturnRates;
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
    () => buildShortKPredictionSeries(deferredSortedRows, deferredDetailRows, annualReturnRates),
    [deferredSortedRows, deferredDetailRows, annualReturnRates],
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

