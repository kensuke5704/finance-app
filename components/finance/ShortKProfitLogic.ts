"use client";

import type { InvestmentRecord, MonthlyRecord } from "../../types/finance";
import { n } from "./financeUtils";
import {
  DEFAULT_SHORT_K_ANNUAL_RETURN_RATES,
  SHORT_K_ASSET_ACCOUNTS,
  SHORT_K_BASE_CASH,
  SHORT_K_BASE_MONTH,
  SHORT_K_END,
  SHORT_K_INITIAL_INVESTMENT_PROFIT,
  SHORT_K_START,
  blankMonthly,
  hasShortKActuals,
  inMonthRange,
  isShortKEntered,
  monthsBetween,
  parseShortKActuals,
  previousMonth,
  shortKAccountMonthlyRate,
  shortKActualDelta,
  shortKAssetRowMatches,
  shortKBudget,
  shortKBudgetDelta,
  shortKInvestmentIncomeCumulative,
} from "./ShortKLogic";

function shortKBaseCash(rows: MonthlyRecord[]) {
  return rows.some((row) => row.user_key === "secondary") ? 0 : SHORT_K_BASE_CASH;
}

function shortKInitialInvestmentProfit(rows: MonthlyRecord[]) {
  return rows.some((row) => row.user_key === "secondary")
    ? 0
    : SHORT_K_INITIAL_INVESTMENT_PROFIT;
}
import type {
  ShortKAnnualReturnRates,
  ShortKAssetAccountKey,
} from "./ShortKLogic";

const SHORT_K_ASSET_KEYS = Object.keys(
  SHORT_K_ASSET_ACCOUNTS,
) as ShortKAssetAccountKey[];
const SHORT_K_ACTUAL_EVALUATION_NOTE_KEY = "shortKActualEvaluation";

type AccountState = {
  principal: number;
  previousValue: number;
  hasActualBaseline: boolean;
};

function parseInvestmentNote(row?: InvestmentRecord) {
  if (!row?.note) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(row.note);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {} as Record<string, unknown>;
  }
}

export function buildShortKAssetEvaluationNote(row?: InvestmentRecord) {
  return JSON.stringify({
    ...parseInvestmentNote(row),
    [SHORT_K_ACTUAL_EVALUATION_NOTE_KEY]: true,
  });
}

function isActualEvaluationRow(row?: InvestmentRecord) {
  if (!row) return false;
  if (row.actual_balance !== 0) return true;
  return parseInvestmentNote(row)[SHORT_K_ACTUAL_EVALUATION_NOTE_KEY] === true;
}

function shortKAssetRawRow(
  accountKey: ShortKAssetAccountKey,
  month: string,
  detailRows: InvestmentRecord[],
) {
  const account = SHORT_K_ASSET_ACCOUNTS[accountKey].account;
  return detailRows.find(
    (item) => item.month === month && shortKAssetRowMatches(item, account),
  );
}

function shortKAssetEvaluationRow(
  accountKey: ShortKAssetAccountKey,
  month: string,
  detailRows: InvestmentRecord[],
) {
  const row = shortKAssetRawRow(accountKey, month, detailRows);
  return isActualEvaluationRow(row) ? row : undefined;
}

export function shortKAccountHasEvaluation(
  accountKey: ShortKAssetAccountKey,
  month: string,
  detailRows: InvestmentRecord[],
) {
  return Boolean(shortKAssetEvaluationRow(accountKey, month, detailRows));
}

export function shortKAccountEvaluation(
  accountKey: ShortKAssetAccountKey,
  month: string,
  detailRows: InvestmentRecord[],
) {
  return shortKAssetEvaluationRow(accountKey, month, detailRows)?.actual_balance ?? 0;
}

function shortKAccountDepositForMonthInternal(
  accountKey: ShortKAssetAccountKey,
  month: string,
  rows: MonthlyRecord[],
) {
  const zeroFallback = rows.some((row) => row.user_key === "secondary");
  const config = SHORT_K_ASSET_ACCOUNTS[accountKey];
  const row = rows.find((item) => item.month === month);
  const actuals = parseShortKActuals(row);
  const budget = zeroFallback && !row
    ? shortKBudget(month, { ...blankMonthly(month), user_key: "secondary" })
    : shortKBudget(month, row);
  return row && hasShortKActuals(actuals)
    ? actuals[config.actualKey]
    : n(budget[config.budgetKey]);
}

function applyDepositToPrincipal(
  principal: number,
  previousValue: number,
  deposit: number,
) {
  if (deposit >= 0) return principal + deposit;

  const withdrawal = Math.abs(deposit);
  const basisValue = previousValue > 0 ? previousValue : principal;
  const principalRatio = basisValue > 0
    ? Math.min(1, Math.max(0, principal / basisValue))
    : 1;

  return Math.max(0, principal - withdrawal * principalRatio);
}

function nextPredictedValue(
  previousValue: number,
  deposit: number,
  monthlyRate: number,
) {
  return Math.max(0, previousValue * (1 + monthlyRate) + deposit);
}

export function shortKAccountPrincipal(
  accountKey: ShortKAssetAccountKey,
  month: string,
  rows: MonthlyRecord[],
  detailRows: InvestmentRecord[] = [],
  annualReturnRates: Partial<ShortKAnnualReturnRates> = DEFAULT_SHORT_K_ANNUAL_RETURN_RATES,
) {
  if (!month || month <= SHORT_K_BASE_MONTH) return 0;

  let principal = 0;
  let previousValue = 0;

  for (const currentMonth of monthsBetween(SHORT_K_START, month)) {
    const deposit = shortKAccountDepositForMonthInternal(
      accountKey,
      currentMonth,
      rows,
    );
    principal = applyDepositToPrincipal(principal, previousValue, deposit);

    const evaluationRow = shortKAssetEvaluationRow(
      accountKey,
      currentMonth,
      detailRows,
    );
    previousValue = evaluationRow
      ? evaluationRow.actual_balance
      : nextPredictedValue(
          previousValue,
          deposit,
          shortKAccountMonthlyRate(accountKey, annualReturnRates),
        );
  }

  return principal;
}

export function shortKAccountPredictedValue(
  accountKey: ShortKAssetAccountKey,
  month: string,
  rows: MonthlyRecord[],
  detailRows: InvestmentRecord[],
  annualReturnRates: Partial<ShortKAnnualReturnRates> = DEFAULT_SHORT_K_ANNUAL_RETURN_RATES,
) {
  if (!month || month <= SHORT_K_BASE_MONTH) return 0;

  let previousValue = 0;
  for (const currentMonth of monthsBetween(SHORT_K_START, month)) {
    const evaluationRow = shortKAssetEvaluationRow(
      accountKey,
      currentMonth,
      detailRows,
    );
    const deposit = shortKAccountDepositForMonthInternal(
      accountKey,
      currentMonth,
      rows,
    );

    previousValue = evaluationRow
      ? evaluationRow.actual_balance
      : nextPredictedValue(
          previousValue,
          deposit,
          shortKAccountMonthlyRate(accountKey, annualReturnRates),
        );
  }

  return previousValue;
}

export function shortKAssetSummary(
  month: string,
  rows: MonthlyRecord[],
  detailRows: InvestmentRecord[],
  annualReturnRates: Partial<ShortKAnnualReturnRates> = DEFAULT_SHORT_K_ANNUAL_RETURN_RATES,
) {
  return SHORT_K_ASSET_KEYS.reduce(
    (summary, key) => {
      const principal = shortKAccountPrincipal(
        key,
        month,
        rows,
        detailRows,
        annualReturnRates,
      );
      const evaluationRow = shortKAssetEvaluationRow(key, month, detailRows);
      const predicted = shortKAccountPredictedValue(
        key,
        month,
        rows,
        detailRows,
        annualReturnRates,
      );
      const value = evaluationRow ? evaluationRow.actual_balance : predicted;
      return {
        principal: summary.principal + principal,
        value: summary.value + value,
        profit: summary.profit + value - principal,
      };
    },
    { principal: 0, value: 0, profit: 0 },
  );
}

export function shortKAssetActualSummary(
  month: string,
  rows: MonthlyRecord[],
  detailRows: InvestmentRecord[],
) {
  return SHORT_K_ASSET_KEYS.reduce(
    (summary, key) => {
      const principal = shortKAccountPrincipal(key, month, rows, detailRows);
      const evaluationRow = shortKAssetEvaluationRow(key, month, detailRows);
      const evaluation = evaluationRow?.actual_balance ?? 0;
      return {
        principal: summary.principal + principal,
        value: summary.value + evaluation,
        profit: summary.profit + (evaluationRow && principal > 0 ? evaluation - principal : 0),
        hasEvaluation: summary.hasEvaluation || Boolean(evaluationRow),
      };
    },
    { principal: 0, value: 0, profit: 0, hasEvaluation: false },
  );
}

export function shortKTotalInvestmentProfit(
  month: string,
  rows: MonthlyRecord[],
  detailRows: InvestmentRecord[],
) {
  return buildShortKPredictionSeries(rows, detailRows).find(
    (row) => row.label === month,
  )?.cumulativeProfitActual;
}

export function shortKAdjustedAssetSummary(
  month: string,
  rows: MonthlyRecord[],
  detailRows: InvestmentRecord[],
  annualReturnRates: Partial<ShortKAnnualReturnRates> = DEFAULT_SHORT_K_ANNUAL_RETURN_RATES,
) {
  const summary = shortKAssetSummary(month, rows, detailRows, annualReturnRates);
  const hasActivity = summary.value !== 0 || summary.principal !== 0;
  return {
    ...summary,
    profit: hasActivity
      ? summary.profit - shortKInitialInvestmentProfit(rows) +
        shortKInvestmentIncomeCumulative(month, rows, true)
      : 0,
  };
}

export function buildShortKPredictionSeries(
  sortedRows: MonthlyRecord[],
  detailRows: InvestmentRecord[],
  annualReturnRates: Partial<ShortKAnnualReturnRates> = DEFAULT_SHORT_K_ANNUAL_RETURN_RATES,
) {
  const allMonths = monthsBetween(SHORT_K_START, SHORT_K_END);
  const zeroFallback = sortedRows.some((row) => row.user_key === "secondary");
  const rowByMonth = new Map(sortedRows.map((row) => [row.month, row]));

  const latestEnteredMonth = [...sortedRows]
    .filter((row) => inMonthRange(row.month) && isShortKEntered(row))
    .map((row) => row.month)
    .sort()
    .at(-1);

  const baseCash = shortKBaseCash(sortedRows);
  const initialInvestmentProfit = shortKInitialInvestmentProfit(sortedRows);
  let cashBalance = baseCash;
  let projectedBalance = baseCash;
  let latestEnteredCashBalance: number | undefined;

  let cumulativeProfitActualRunning = -initialInvestmentProfit;
  let previousActualInvestmentValue = 0;
  let pendingActualInvestmentDeposit = 0;
  let pendingActualInvestmentWithdrawal = 0;
  let pendingActualInvestmentIncome = 0;
  let pendingActualGiftIncome = 0;
  let pendingActualGiftOutgo = 0;
  let giftOutgoActualRunning = 0;

  let cumulativeProfitWithBudgetRunning = -initialInvestmentProfit;
  let previousInvestmentValueWithBudget = 0;
  let giftOutgoBudgetRunning = 0;

  const accountStates: Record<ShortKAssetAccountKey, AccountState> = {
    fund: { principal: 0, previousValue: 0, hasActualBaseline: false },
    active: { principal: 0, previousValue: 0, hasActualBaseline: false },
    usd: { principal: 0, previousValue: 0, hasActualBaseline: false },
  };

  const rawRows = allMonths.map((month) => {
    const row = rowByMonth.get(month);
    const actuals = parseShortKActuals(row);
    const isEntered = Boolean(row && hasShortKActuals(actuals));
    const previousRow = rowByMonth.get(previousMonth(month));
    const previousActuals = parseShortKActuals(previousRow);

    cashBalance += isEntered
      ? shortKActualDelta(actuals, previousActuals)
      : shortKBudgetDelta(month, row, zeroFallback);

    if (month === latestEnteredMonth) {
      latestEnteredCashBalance = cashBalance;
      projectedBalance = cashBalance;
    } else if (!latestEnteredMonth || month > latestEnteredMonth) {
      projectedBalance += shortKBudgetDelta(month, row, zeroFallback);
    }

    const monthlyBudget = zeroFallback && !row
      ? shortKBudget(month, { ...blankMonthly(month), user_key: "secondary" })
      : shortKBudget(month, row);
    const investmentIncomeForProfit = isEntered
      ? actuals.incomeInvestment + actuals.giftIncome - actuals.giftOutgo
      : monthlyBudget.incomeInvestmentBudget +
        n(monthlyBudget.giftIncomeBudget) -
        n(monthlyBudget.giftOutgoBudget);
    giftOutgoActualRunning += isEntered ? actuals.giftOutgo : 0;
    giftOutgoBudgetRunning += isEntered
      ? actuals.giftOutgo
      : n(monthlyBudget.giftOutgoBudget);

    let investmentDepositWithBudget = 0;
    let investmentWithdrawalWithBudget = 0;
    let actualValue = 0;
    let summaryPrincipal = 0;
    let summaryValue = 0;
    let hasRequiredActualAccount = false;
    let hasAllRequiredEvaluations = true;

    SHORT_K_ASSET_KEYS.forEach((key) => {
      const state = accountStates[key];
      const config = SHORT_K_ASSET_ACCOUNTS[key];
      const deposit = isEntered
        ? actuals[config.actualKey]
        : n(monthlyBudget[config.budgetKey]);

      if (isEntered) {
        if (actuals[config.actualKey] >= 0) {
          pendingActualInvestmentDeposit += actuals[config.actualKey];
        } else {
          pendingActualInvestmentWithdrawal += Math.abs(actuals[config.actualKey]);
        }
      }

      if (deposit >= 0) {
        investmentDepositWithBudget += deposit;
      } else {
        investmentWithdrawalWithBudget += Math.abs(deposit);
      }

      state.principal = applyDepositToPrincipal(
        state.principal,
        state.previousValue,
        deposit,
      );

      const evaluationRow = shortKAssetEvaluationRow(key, month, detailRows);
      const requiresActualEvaluation =
        state.principal > 0 || state.hasActualBaseline || Boolean(evaluationRow);

      if (requiresActualEvaluation) {
        hasRequiredActualAccount = true;
        if (evaluationRow) {
          actualValue += evaluationRow.actual_balance;
          state.hasActualBaseline = true;
        } else {
          hasAllRequiredEvaluations = false;
        }
      }

      state.previousValue = evaluationRow
        ? evaluationRow.actual_balance
        : nextPredictedValue(
            state.previousValue,
            deposit,
            shortKAccountMonthlyRate(key, annualReturnRates),
          );

      summaryPrincipal += state.principal;
      summaryValue += state.previousValue;
    });

    if (isEntered) {
      pendingActualInvestmentIncome += actuals.incomeInvestment;
      pendingActualGiftIncome += actuals.giftIncome;
      pendingActualGiftOutgo += actuals.giftOutgo;
    }

    let totalActualProfit: number | undefined;
    const hasGiftActivity =
      actuals.giftIncome !== 0 || actuals.giftOutgo !== 0;
    const hasCompleteEvaluation =
      (hasRequiredActualAccount && hasAllRequiredEvaluations) ||
      (!hasRequiredActualAccount && hasGiftActivity);
    if (hasCompleteEvaluation) {
      cumulativeProfitActualRunning +=
        (actualValue - previousActualInvestmentValue) -
        pendingActualInvestmentDeposit +
        pendingActualInvestmentWithdrawal +
        pendingActualInvestmentIncome +
        pendingActualGiftIncome -
        pendingActualGiftOutgo;
      previousActualInvestmentValue = actualValue;
      pendingActualInvestmentDeposit = 0;
      pendingActualInvestmentWithdrawal = 0;
      pendingActualInvestmentIncome = 0;
      pendingActualGiftIncome = 0;
      pendingActualGiftOutgo = 0;
      totalActualProfit = cumulativeProfitActualRunning;
    }

    cumulativeProfitWithBudgetRunning +=
      (summaryValue - previousInvestmentValueWithBudget) -
      investmentDepositWithBudget +
      investmentWithdrawalWithBudget +
      investmentIncomeForProfit;
    previousInvestmentValueWithBudget = summaryValue;

    const hasBudgetActivity =
      summaryValue !== 0 ||
      summaryPrincipal !== 0 ||
      investmentDepositWithBudget !== 0 ||
      investmentWithdrawalWithBudget !== 0 ||
      n(monthlyBudget.giftIncomeBudget) !== 0 ||
      n(monthlyBudget.giftOutgoBudget) !== 0 ||
      hasGiftActivity;
    const adjustedProfit = hasBudgetActivity ? cumulativeProfitWithBudgetRunning : 0;

    return {
      label: month,
      cashActual: isEntered ? cashBalance : undefined,
      cashPrediction: latestEnteredMonth
        ? month === latestEnteredMonth
          ? latestEnteredCashBalance
          : month > latestEnteredMonth
            ? projectedBalance
            : undefined
        : projectedBalance,
      assetActual: isEntered
        ? cashBalance + summaryValue - giftOutgoActualRunning
        : undefined,
      assetPrediction: (latestEnteredMonth ? month >= latestEnteredMonth : true)
        ? projectedBalance + summaryValue - giftOutgoBudgetRunning
        : undefined,
      cumulativeProfitActual: hasCompleteEvaluation ? totalActualProfit : undefined,
      cumulativeProfitPrediction: undefined as number | undefined,
      __hasCompleteEvaluation: hasCompleteEvaluation,
      __adjustedProfit: adjustedProfit,
    };
  });

  const latestProfit = [...rawRows]
    .reverse()
    .find(
      (row) =>
        row.__hasCompleteEvaluation && row.cumulativeProfitActual !== undefined,
    );
  const latestProjectedBase = latestProfit?.__adjustedProfit ?? 0;
  const latestProfitValue = latestProfit?.cumulativeProfitActual;
  const latestProfitMonth = latestProfit?.label;

  return rawRows.map((row) => {
    const cumulativeProfitPrediction = latestProfitMonth && latestProfitValue !== undefined
      ? row.label >= latestProfitMonth
        ? latestProfitValue + (row.__adjustedProfit - latestProjectedBase)
        : undefined
      : row.__adjustedProfit !== 0
        ? row.__adjustedProfit
        : undefined;

    const { __hasCompleteEvaluation, __adjustedProfit, ...publicRow } = row;
    return { ...publicRow, cumulativeProfitPrediction };
  });
}
