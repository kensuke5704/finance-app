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

export function LongPlanView({
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

