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
  secondaryProfile = false,
  onGiftChange,
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
  secondaryProfile?: boolean;
  onGiftChange?: (month: string, type: "actual" | "budget", value: number) => void;
}) {
  const defaultSelectedMonth = selectedMonth || currentMonthString();
  const [selectedYear, setSelectedYear] = useState(
    defaultSelectedMonth.slice(0, 4),
  );
  const [selectedMonthNumber, setSelectedMonthNumber] = useState(
    defaultSelectedMonth.slice(5, 7),
  );
  const [shortKChartTab, setShortKChartTab] = useState<"cash" | "profit">("cash");
  const [homeChartMetric, setHomeChartMetric] = useState<"asset" | "profit">("asset");
  const [showAssetAmounts, setShowAssetAmounts] = useState(true);
  const assetVisibilityKey = `finance.shortK.assetAmountsVisible.${secondaryProfile ? "secondary" : "primary"}`;

  useEffect(() => {
    const nextSelectedMonth = selectedMonth || currentMonthString();
    setSelectedYear(nextSelectedMonth.slice(0, 4));
    setSelectedMonthNumber(nextSelectedMonth.slice(5, 7));
  }, [selectedMonth]);

  useEffect(() => {
    setShowAssetAmounts(readLocalStorage(assetVisibilityKey) !== "false");
  }, [assetVisibilityKey]);

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
  const visibleShortKSeries = useMemo(
    () => {
      const lastActualIndex = shortKSeries.findLastIndex(
        (row) =>
          typeof row.assetActual === "number" ||
          typeof row.cashActual === "number",
      );
      const anchorIndex = Math.max(lastActualIndex, 0);
      return shortKSeries.map((row, index) => {
        const isPredictionRange = index >= anchorIndex;
        return {
          ...row,
          cashActualDisplay: row.cashActual,
          cashPredictionDisplay: isPredictionRange
            ? row.cashPrediction
            : undefined,
          assetActualDisplay: row.assetActual,
          assetPredictionDisplay: isPredictionRange
            ? row.assetPrediction
            : undefined,
        };
      });
    },
    [shortKSeries],
  );
  const visibleProfitSeries = useMemo(() => {
    const lastActualIndex = shortKSeries.findLastIndex(
      (row) => typeof row.cumulativeProfitActual === "number",
    );
    const anchorIndex = Math.max(lastActualIndex, 0);
    return shortKSeries.map((row, index) => ({
      ...row,
      cumulativeProfitPredictionDisplay:
        index >= anchorIndex
          ? row.cumulativeProfitPrediction
          : undefined,
    }));
  }, [shortKSeries]);
  const latestAssetActualIndex = useMemo(
    () =>
      visibleShortKSeries.findLastIndex(
        (row) =>
          typeof row.assetActualDisplay === "number" ||
          typeof row.cashActualDisplay === "number",
      ),
    [visibleShortKSeries],
  );
  const latestProfitActualIndex = useMemo(
    () =>
      visibleProfitSeries.findLastIndex(
        (row) => typeof row.cumulativeProfitActual === "number",
      ),
    [visibleProfitSeries],
  );
  const currentMonthChartIndex = useMemo(() => {
    const currentMonth = currentMonthString();
    const index = visibleShortKSeries.findIndex(
      (row) => String(row.label) === currentMonth,
    );
    return index >= 0 ? index : latestAssetActualIndex;
  }, [latestAssetActualIndex, visibleShortKSeries]);
  const latestShortKSnapshot = useMemo(() => {
    const latestCashActual = [...shortKSeries].reverse().find((row) => typeof row.cashActual === "number");
    const latestAssetActual = [...shortKSeries].reverse().find((row) => typeof row.assetActual === "number");
    const latestProfitActual = [...shortKSeries].reverse().find((row) => typeof row.cumulativeProfitActual === "number");
    const latestCashAny = latestCashActual ?? [...shortKSeries].reverse().find((row) => typeof row.cashPrediction === "number");
    const latestAssetAny = latestAssetActual ?? [...shortKSeries].reverse().find((row) => typeof row.assetPrediction === "number");
    const latestProfitAny = latestProfitActual ?? [...shortKSeries].reverse().find((row) => typeof row.cumulativeProfitPrediction === "number");
    const actualSnapshots = shortKSeries.filter(
      (row) =>
        typeof row.cashActual === "number" ||
        typeof row.assetActual === "number",
    );
    const currentActual = actualSnapshots.at(-1);
    const previousActual = actualSnapshots.at(-2);
    const profitSnapshots = shortKSeries.filter(
      (row) => typeof row.cumulativeProfitActual === "number",
    );
    const currentProfit = profitSnapshots.at(-1);
    const previousProfit = profitSnapshots.at(-2);
    const currentProfitValue = currentProfit?.cumulativeProfitActual;
    const previousProfitValue = previousProfit?.cumulativeProfitActual;
    const currentAssetValue = currentActual?.assetActual;
    const previousAssetValue = previousActual?.assetActual;
    const profitRate =
      typeof currentProfitValue === "number" &&
      typeof currentAssetValue === "number" &&
      currentAssetValue - currentProfitValue !== 0
        ? (currentProfitValue / (currentAssetValue - currentProfitValue)) * 100
        : null;
    const previousProfitRate =
      typeof previousProfitValue === "number" &&
      typeof previousAssetValue === "number" &&
      previousAssetValue - previousProfitValue !== 0
        ? (previousProfitValue / (previousAssetValue - previousProfitValue)) *
          100
        : null;

    return {
      cash: typeof latestCashAny?.cashActual === "number" ? latestCashAny.cashActual : latestCashAny?.cashPrediction,
      asset: typeof latestAssetAny?.assetActual === "number" ? latestAssetAny.assetActual : latestAssetAny?.assetPrediction,
      profit: typeof latestProfitAny?.cumulativeProfitActual === "number" ? latestProfitAny.cumulativeProfitActual : latestProfitAny?.cumulativeProfitPrediction,
      cashChange:
        typeof currentActual?.cashActual === "number" &&
        typeof previousActual?.cashActual === "number"
          ? currentActual.cashActual - previousActual.cashActual
          : null,
      assetChange:
        typeof currentActual?.assetActual === "number" &&
        typeof previousActual?.assetActual === "number"
          ? currentActual.assetActual - previousActual.assetActual
          : null,
      profitChange:
        typeof currentProfitValue === "number" &&
        typeof previousProfitValue === "number"
          ? currentProfitValue - previousProfitValue
          : null,
      profitRate,
      profitRateChange:
        profitRate !== null && previousProfitRate !== null
          ? profitRate - previousProfitRate
          : null,
    };
  }, [shortKSeries]);
  const selectedActuals = parseShortKActuals(selectedMonthly);
  const selectedBudgetRow = selectedMonthly && secondaryProfile
    ? { ...selectedMonthly, user_key: "secondary" }
    : selectedMonthly;
  const selectedBudget = shortKBudget(
    selectedMonthKey,
    selectedBudgetRow ?? (secondaryProfile
      ? { ...blankMonthly(selectedMonthKey), user_key: "secondary" }
      : undefined),
  );
  const previousRow = selectedMonthKey
    ? rows.find((row) => row.month === previousMonth(selectedMonthKey))
    : undefined;
  const previousActuals = parseShortKActuals(previousRow);
  const incomeTotal = shortKIncomeTotal(selectedActuals);
  const outgoTotal = shortKOutgoTotal(selectedActuals, previousActuals);
  const investmentTotal = shortKInvestmentTotal(selectedActuals);
  const incomeBudgetTotal = shortKBudgetIncomeTotal(selectedBudget);
  const investmentBudgetTotal = shortKBudgetInvestmentTotal(selectedBudget);
  const outgoBudgetTotal = selectedBudget.outgoBudget + (selectedBudget.giftOutgoBudget ?? 0);
  const budgetNet = incomeBudgetTotal - outgoBudgetTotal;
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
    if (key === "giftIncome" || key === "giftOutgo") {
      onGiftChange?.(selectedMonthKey, "actual", value);
    }
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
    if (key === "giftIncomeBudget" || key === "giftOutgoBudget") {
      onGiftChange?.(selectedMonthKey, "budget", value);
    }
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

  const updateSelectedMonthKey = (month: string) => {
    if (!month) {
      setSelectedYear("");
      setSelectedMonthNumber("");
      setSelectedMonth("");
      return;
    }
    setSelectedYear(month.slice(0, 4));
    setSelectedMonthNumber(month.slice(5, 7));
    setSelectedMonth(month);
  };

  const selectableMonths = shortKYearOptions().flatMap((year) =>
    shortKMonthOptions(year).map((month) => `${year}-${month}`),
  );

  const moveSelectedShortKMonth = (diff: number) => {
    if (!selectedMonthKey) return;
    const [year, month] = selectedMonthKey.split("-").map(Number);
    const date = new Date(year, month - 1 + diff, 1);
    const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!inMonthRange(next)) return;
    setSelectedMonth(next);
  };

  return (
    <section className="stack">
      <div className="chart-tab-panel">
        <div className="chart-tabs">
          <button
            className={`chart-tab ${shortKChartTab === "cash" ? "active" : ""}`}
            onClick={() => setShortKChartTab("cash")}
          >
            ダッシュボード
          </button>
          <button
            className={`chart-tab ${shortKChartTab === "profit" ? "active" : ""}`}
            onClick={() => setShortKChartTab("profit")}
          >
            月次履歴
          </button>
        </div>
        {shortKChartTab === "cash" && homeChartMetric === "asset" ? (
          <div className={`chart-top-summary two-items ${showAssetAmounts ? "" : "amounts-hidden"}`}>
            <div>
              <span>現在の現金</span>
              <b>{showAssetAmounts && typeof latestShortKSnapshot.cash === "number" ? money(latestShortKSnapshot.cash) : "••••••"}</b>
              <small className="home-summary-change">
                <i aria-hidden="true" />
                前月比 {showAssetAmounts ? (latestShortKSnapshot.cashChange === null ? "-" : signedMoney(latestShortKSnapshot.cashChange)) : "••••"}
              </small>
            </div>
            <div>
              <span>現在の資産合計</span>
              <button
                type="button"
                className="amount-visibility-toggle"
                onClick={() => setShowAssetAmounts((current) => {
                  const next = !current;
                  writeLocalStorage(assetVisibilityKey, String(next));
                  return next;
                })}
              >
                {showAssetAmounts ? "金額を隠す" : "金額を表示"}
              </button>
              <b>{showAssetAmounts && typeof latestShortKSnapshot.asset === "number" ? money(latestShortKSnapshot.asset) : "••••••"}</b>
              <small className="home-summary-change asset">
                <i aria-hidden="true" />
                前月比 {showAssetAmounts ? (latestShortKSnapshot.assetChange === null ? "-" : signedMoney(latestShortKSnapshot.assetChange)) : "••••"}
              </small>
            </div>
          </div>
        ) : shortKChartTab === "cash" ? (
          <div className="chart-top-summary two-items profit-summary">
            <div>
              <span>通算損益</span>
              <b>{typeof latestShortKSnapshot.profit === "number" ? signedMoney(latestShortKSnapshot.profit) : "-"}</b>
              <small className="home-summary-change">
                <i aria-hidden="true" />
                前月比 {latestShortKSnapshot.profitChange === null ? "-" : signedMoney(latestShortKSnapshot.profitChange)}
              </small>
            </div>
            <div>
              <span>収益率</span>
              <b>
                {latestShortKSnapshot.profitRate === null
                  ? "-"
                  : `${latestShortKSnapshot.profitRate >= 0 ? "+" : ""}${latestShortKSnapshot.profitRate.toFixed(2)}%`}
              </b>
              <small className="home-summary-change asset">
                <i aria-hidden="true" />
                前月比 {latestShortKSnapshot.profitRateChange === null
                  ? "-"
                  : `${latestShortKSnapshot.profitRateChange >= 0 ? "+" : ""}${latestShortKSnapshot.profitRateChange.toFixed(2)}%`}
              </small>
            </div>
          </div>
        ) : null}
        {shortKChartTab === "cash" && (
          <>
          <div className="chart-tabs short-k-chart-selector" role="tablist" aria-label="グラフ表示">
            <button
              className={`chart-tab ${homeChartMetric === "asset" ? "active" : ""}`}
              type="button"
              role="tab"
              aria-selected={homeChartMetric === "asset"}
              onClick={() => setHomeChartMetric("asset")}
            >
              資産推移
            </button>
            <button
              className={`chart-tab ${homeChartMetric === "profit" ? "active" : ""}`}
              type="button"
              role="tab"
              aria-selected={homeChartMetric === "profit"}
              onClick={() => setHomeChartMetric("profit")}
            >
              通算損益
            </button>
          </div>
          <div className="short-k-chart-single">
            {homeChartMetric === "asset" ? (
            <MultiLineChart
              key={`${secondaryProfile ? "secondary" : "primary"}-cash`}
              title="資産推移"
              rows={visibleShortKSeries}
              series={[
                {
                  key: "assetActualDisplay",
                  label: "資産合計",
                  colorIndex: 1,
                },
                {
                  key: "assetPredictionDisplay",
                  label: "資産予測",
                  colorIndex: 1,
                  dashed: true,
                  hideLegend: true,
                },
                {
                  key: "cashActualDisplay",
                  label: "現金",
                  colorIndex: 0,
                },
                {
                  key: "cashPredictionDisplay",
                  label: "現金予測",
                  colorIndex: 0,
                  dashed: true,
                  hideLegend: true,
                },
              ]}
              showYAxis
              yAxisWidth={72}
              areaKey="assetActualDisplay"
              chartHeight={300}
              initialFocusIndex={currentMonthChartIndex}
              initialVisiblePoints={61}
              initialPointsBeforeFocus={12}
              storageKey={`finance.shortK.chartZoom.cash.v5${secondaryProfile ? ".secondary" : ""}`}
            />
            ) : (
            <MultiLineChart
              key={`${secondaryProfile ? "secondary" : "primary"}-profit`}
              title="通算損益推移"
              rows={visibleProfitSeries}
              series={[
                { key: "cumulativeProfitActual", label: "通算損益", colorIndex: 1 },
                {
                  key: "cumulativeProfitPredictionDisplay",
                  label: "通算損益予測",
                  colorIndex: 1,
                  dashed: true,
                  hideLegend: true,
                },
              ]}
              showYAxis
              yAxisWidth={72}
              areaKey="cumulativeProfitActual"
              chartHeight={300}
              initialFocusIndex={
                currentMonthChartIndex >= 0
                  ? currentMonthChartIndex
                  : latestProfitActualIndex
              }
              initialVisiblePoints={61}
              initialPointsBeforeFocus={12}
              storageKey={`finance.shortK.chartZoom.profit.v5${secondaryProfile ? ".secondary" : ""}`}
            />
            )}
          </div>
          </>
        )}
      </div>

      {shortKChartTab === "cash" ? (
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
              <div className="month-select-grid month-select-single">
                <label className="field">
                  <span className="label">対象月</span>
                  <select
                    className="input editable-input"
                    value={selectedMonthKey}
                    onChange={(e) => updateSelectedMonthKey(e.target.value)}
                  >
                    <option value="">選択</option>
                    {selectableMonths.map((month) => (
                      <option key={month} value={month}>
                        {`${month.slice(0, 4)}年${Number(month.slice(5, 7))}月`}
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
              <>
                <div className="home-actual-columns" aria-hidden="true">
                  <span />
                  <span>予算</span>
                  <span>実績</span>
                </div>
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
                  open
                  onToggle={() => undefined}
                  collapsible={false}
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
                  {!secondaryProfile && (
                    <MemoBudgetActualRow
                      label="贈与"
                      budget={selectedBudget.giftIncomeBudget ?? 0}
                      actual={selectedActuals.giftIncome}
                      onChange={(value) => updateActual("giftIncome", value)}
                    />
                  )}
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
                      budget={outgoBudgetTotal}
                      actual={outgoTotal}
                      compact
                    />
                  }
                  open
                  onToggle={() => undefined}
                  collapsible={false}
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
                  {secondaryProfile && (
                    <MemoBudgetActualRow
                      label="贈与"
                      budget={selectedBudget.giftOutgoBudget ?? 0}
                      actual={selectedActuals.giftOutgo}
                      onChange={(value) => updateActual("giftOutgo", value)}
                    />
                  )}
                  <MemoBudgetActualSummary
                    label="支出合計"
                    budget={outgoBudgetTotal}
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
                  open
                  onToggle={() => undefined}
                  collapsible={false}
                >
                  <MemoBudgetActualRow
                    label="投資信託"
                    budget={selectedBudget.fundInvestmentBudget}
                    actual={selectedActuals.fundInvestment}
                    onChange={(value) => updateActual("fundInvestment", value)}
                  />
                  {!secondaryProfile && (
                    <>
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
                    </>
                  )}
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
                        ? "-"
                        : money(calculatedDeposit)
                      : predictedDeposit === undefined
                        ? "-"
                        : money(predictedDeposit)}
                  </b>
                </div>
                </div>
              </>
            )}
          </div>
        </div>

      </section>
      ) : (
        <section className="short-k-history-view">
          <MemoMonthlyTable
            rows={enteredRows}
            onSelect={handleMonthlySelect}
            onDelete={handleMonthlyDelete}
          />
        </section>
      )}
    </section>
  );
}
