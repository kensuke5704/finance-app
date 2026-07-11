"use client";

import { useEffect, useState } from "react";
import type { InvestmentRecord, MonthlyRecord } from "../../types/finance";
import { money, signedMoney, signedRate } from "./financeUtils";
import type { ShortKAssetAccountKey, ShortKAnnualReturnRates } from "./FinanceShared";
import {
  SHORT_K_ASSET_ACCOUNTS,
  SHORT_K_END,
  SHORT_K_START,
  MoneyInput,
  blankMonthly,
  buildShortKAssetEvaluationNote,
  currentMonthString,
  getShortKAssetRows,
  hasShortKActuals,
  inMonthRange,
  monthsBetween,
  parseShortKActuals,
  shortKBudget,
  shortKAccountPredictedValue,
  shortKAccountPrincipal,
  shortKAssetActualSummary,
  shortKAssetRowMatches,
  shortKAssetSummary,
  shortKMonthOptions,
  shortKYearOptions,
} from "./FinanceShared";

function hasExplicitAssetEvaluation(row?: InvestmentRecord) {
  if (!row) return false;
  if (row.actual_balance !== 0) return true;
  if (!row.note) return false;
  try {
    const parsed = JSON.parse(row.note) as Record<string, unknown>;
    return parsed.shortKActualEvaluation === true;
  } catch {
    return false;
  }
}

export function ShortKAssetManagementView({
  rows,
  detailRows,
  selectedMonth,
  setSelectedMonth,
  upsertInvestment,
  deleteInvestment,
  annualReturnRates,
  onRefresh,
  secondaryProfile = false,
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
  deleteInvestment: (id: string) => void;
  annualReturnRates: ShortKAnnualReturnRates;
  onRefresh: () => Promise<void>;
  secondaryProfile?: boolean;
}) {
  const defaultSelectedMonth = selectedMonth || currentMonthString();
  const [selectedYear, setSelectedYear] = useState(defaultSelectedMonth.slice(0, 4));
  const [selectedMonthNumber, setSelectedMonthNumber] = useState(defaultSelectedMonth.slice(5, 7));
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const nextSelectedMonth = selectedMonth || currentMonthString();
    setSelectedYear(nextSelectedMonth.slice(0, 4));
    setSelectedMonthNumber(nextSelectedMonth.slice(5, 7));
  }, [selectedMonth]);

  const selectedMonthKey = selectedYear && selectedMonthNumber ? `${selectedYear}-${selectedMonthNumber}` : "";
  const visibleDetailRows = secondaryProfile
    ? detailRows.filter((row) => shortKAssetRowMatches(row, SHORT_K_ASSET_ACCOUNTS.fund.account))
    : detailRows;
  const selectedAssetRows = selectedMonthKey ? getShortKAssetRows(visibleDetailRows, selectedMonthKey) : [];
  const secondaryFundRow = selectedAssetRows.find((row) =>
    shortKAssetRowMatches(row, SHORT_K_ASSET_ACCOUNTS.fund.account)
  );
  const secondaryFundPrincipal = selectedMonthKey
    ? shortKAccountPrincipal("fund", selectedMonthKey, rows, visibleDetailRows, annualReturnRates)
    : 0;
  const secondaryFundPrediction = selectedMonthKey
    ? shortKAccountPredictedValue("fund", selectedMonthKey, rows, visibleDetailRows, annualReturnRates)
    : 0;
  const secondaryGiftOutgo = secondaryProfile && selectedMonthKey
    ? monthsBetween(SHORT_K_START, selectedMonthKey).reduce((total, month) => {
        const row = rows.find((item) => item.month === month);
        const actuals = parseShortKActuals(row);
        if (row && hasShortKActuals(actuals)) return total + actuals.giftOutgo;
        return total + (shortKBudget(
          month,
          row ?? { ...blankMonthly(month), user_key: "secondary" },
        ).giftOutgoBudget ?? 0);
      }, 0)
    : 0;
  const selectedAssetSummary = secondaryProfile
    ? {
        principal: secondaryFundPrincipal,
        value: hasExplicitAssetEvaluation(secondaryFundRow)
          ? secondaryFundRow?.actual_balance ?? 0
          : 0,
        profit: hasExplicitAssetEvaluation(secondaryFundRow)
          ? (secondaryFundRow?.actual_balance ?? 0) - secondaryFundPrincipal
          : 0,
        hasEvaluation: hasExplicitAssetEvaluation(secondaryFundRow),
      }
    : selectedMonthKey
      ? shortKAssetActualSummary(selectedMonthKey, rows, visibleDetailRows)
      : { principal: 0, value: 0, profit: 0, hasEvaluation: false };
  const predictedAssetSummary = secondaryProfile
    ? {
        principal: secondaryFundPrincipal,
        value: secondaryFundPrediction - secondaryGiftOutgo,
        profit: secondaryFundPrediction - secondaryFundPrincipal - secondaryGiftOutgo,
      }
    : selectedMonthKey
      ? shortKAssetSummary(selectedMonthKey, rows, visibleDetailRows, annualReturnRates)
      : { principal: 0, value: 0, profit: 0 };
  const isPredictedSummary = !selectedAssetSummary.hasEvaluation;
  const displayAssetPrincipal = selectedAssetSummary.hasEvaluation
    ? selectedAssetSummary.principal
    : predictedAssetSummary.principal;
  const displayAssetValue = selectedAssetSummary.hasEvaluation
    ? selectedAssetSummary.value
    : predictedAssetSummary.value;
  const displayAssetProfit = selectedAssetSummary.hasEvaluation
    ? selectedAssetSummary.profit
    : predictedAssetSummary.profit;
  const displayProfitRate = signedRate(displayAssetProfit, displayAssetPrincipal);

  const updateSelectedYear = (year: string) => {
    setSelectedYear(year);
    if (!year) {
      setSelectedMonthNumber("");
      setSelectedMonth("");
      return;
    }
    if (selectedMonthNumber && shortKMonthOptions(year).includes(selectedMonthNumber)) {
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

  const updateAssetValue = (account: ShortKAssetAccountKey, value: number) => {
    if (!selectedMonthKey) return;
    const config = SHORT_K_ASSET_ACCOUNTS[account];
    const currentRow = selectedAssetRows.find((row) => shortKAssetRowMatches(row, config.account));
    upsertInvestment(selectedMonthKey, config.account, {
      capital: shortKAccountPrincipal(account, selectedMonthKey, rows, visibleDetailRows, annualReturnRates),
      actual_balance: value,
      predicted_balance: shortKAccountPredictedValue(account, selectedMonthKey, rows, visibleDetailRows, annualReturnRates),
      note: buildShortKAssetEvaluationNote(currentRow),
    });
  };

  const clearAssetValue = (account: ShortKAssetAccountKey) => {
    const config = SHORT_K_ASSET_ACCOUNTS[account];
    const currentRow = selectedAssetRows.find((row) =>
      shortKAssetRowMatches(row, config.account)
    );
    if (currentRow) deleteInvestment(currentRow.id);
  };

  async function refreshAllInvestments() {
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error("Investment refresh failed", error);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="stack">
      <div className="flat-panel">
        <div className="flat-panel-head compact-head">
          <div className="panel-title">総合</div>
          {!secondaryProfile && (
            <button className="btn" type="button" disabled={refreshing} onClick={() => void refreshAllInvestments()}>
              {refreshing ? "更新中…" : "更新"}
            </button>
          )}
        </div>
        <div className="flat-panel-body">
          <div className="month-picker-row">
            <button className="month-arrow" type="button" onClick={() => moveSelectedShortKMonth(-1)} disabled={!selectedMonthKey || selectedMonthKey <= SHORT_K_START}>←</button>
            <div className="month-select-grid month-select-single">
              <label className="field">
                <span className="label">対象月</span>
                <select className="input editable-input" value={selectedMonthKey} onChange={(e) => updateSelectedMonthKey(e.target.value)}>
                  <option value="">選択</option>
                  {selectableMonths.map((month) => <option key={month} value={month}>{`${month.slice(0, 4)}年${Number(month.slice(5, 7))}月`}</option>)}
                </select>
              </label>
            </div>
            <button className="month-arrow" type="button" onClick={() => moveSelectedShortKMonth(1)} disabled={!selectedMonthKey || selectedMonthKey >= SHORT_K_END}>→</button>
          </div>

          {!selectedMonthKey ? (
            <div className="empty-state">年と月を選択してください。</div>
          ) : (
            <div className="stack">
              <div className={`flat-summary-block ${isPredictedSummary ? "prediction-summary" : ""}`}>
                <div className="flat-summary-grid">
                  <div><span className="mini-label">元本合計</span><b>{money(displayAssetPrincipal)}</b></div>
                  <div><span className="mini-label">{selectedAssetSummary.hasEvaluation ? "評価額合計" : "予測額"}</span><b>{money(displayAssetValue)}</b></div>
                </div>
                <div className="flat-result-row">
                  <span>{selectedAssetSummary.hasEvaluation ? "損益" : "予測損益"}</span>
                  <b className={displayAssetProfit < 0 ? "negative" : "positive"}>{signedMoney(displayAssetProfit)}（{displayProfitRate}）</b>
                </div>
              </div>

              {(Object.keys(SHORT_K_ASSET_ACCOUNTS) as ShortKAssetAccountKey[])
                .filter((key) => !secondaryProfile || key === "fund")
                .map((key) => {
                const config = SHORT_K_ASSET_ACCOUNTS[key];
                const row = selectedAssetRows.find((item) => shortKAssetRowMatches(item, config.account));
                const principal = shortKAccountPrincipal(key, selectedMonthKey, rows, visibleDetailRows, annualReturnRates);
                const hasEvaluation = hasExplicitAssetEvaluation(row);
                const evaluation = row?.actual_balance ?? 0;
                const predictedValue = shortKAccountPredictedValue(key, selectedMonthKey, rows, visibleDetailRows, annualReturnRates);
                const profit = hasEvaluation ? evaluation - principal : predictedValue - principal;
                const profitRate = signedRate(profit, principal);

                return (
                  <div className="short-k-input-section always-open" key={key}>
                    <div className="short-k-input-section-head asset-section-static-head">
                      <span>{config.label}</span>
                    </div>
                      <div className={`short-k-input-section-body ${!hasEvaluation ? "prediction-account" : ""}`}>
                        <div className="flat-account-input">
                          <div className="budget-actual-label">{config.label}</div>
                          <div className="budget-actual-two-col">
                            <div className="readonly-box flat-readonly-box"><span className="mini-label">元本</span><b>{money(principal)}</b></div>
                            <label className="actual-input-box flat-input-box">
                              <span className="mini-label">評価額</span>
                              <MoneyInput
                                value={evaluation}
                                onChange={(nextValue) => updateAssetValue(key, nextValue)}
                                commitOnBlur
                                emptyWhenZero={!hasEvaluation}
                                onClear={() => clearAssetValue(key)}
                              />
                            </label>
                          </div>
                        </div>
                        <div className="flat-result-row compact">
                          <span>{hasEvaluation ? "損益" : "予測損益"}</span>
                          <b className={profit < 0 ? "negative" : "positive"}>{signedMoney(profit)}（{profitRate}）</b>
                        </div>
                      </div>
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
