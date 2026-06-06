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

export function ShortMView({
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
