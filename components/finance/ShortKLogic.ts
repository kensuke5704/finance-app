"use client";

import { newMonthlyRecord } from "../../lib/financeStore";
import type { InvestmentRecord, MonthlyRecord } from "../../types/finance";
import {
  actualCash,
  actualIncome,
  actualInvest,
  actualOutgo,
  investmentValue,
  n,
  netAssets,
  totalInvestments,
} from "./financeUtils";

export const SHORT_K_ACCOUNTS = ["WealthNavi", "ROBOPRO", "INDEX", "Active"];
export const SHORT_M_ACCOUNTS = ["Cash", "WealthNavi", "NASDAQ100", "NISA"];

export const SHORT_K_START = "2024-09";
export const SHORT_K_END = "2061-12";
export const SHORT_K_BUDGET_FALLBACK_MONTH = "2031-06";
export const SHORT_K_BASE_MONTH = "2024-08";
export const SHORT_K_BASE_CASH = 2359881;
export const SHORT_K_INITIAL_INVESTMENT_PROFIT = 5371418;
export const SHORT_K_CHART_TAB_STORAGE_KEY = "finance.shortK.chartTab";
export const SHORT_K_MONTHLY_OPEN_YEARS_STORAGE_KEY = "finance.shortK.monthlyOpenYears";

function shortKBaseCash(rows: MonthlyRecord[]) {
  return rows.some((row) => row.user_key === "secondary") ? 0 : SHORT_K_BASE_CASH;
}

function shortKInitialInvestmentProfit(rows: MonthlyRecord[]) {
  return rows.some((row) => row.user_key === "secondary")
    ? 0
    : SHORT_K_INITIAL_INVESTMENT_PROFIT;
}

export {
  ConfirmDialog,
  FormattedNumberInput,
  MoneyInput,
  MonthInput,
  NumberInput,
  TextInput,
} from "./FinanceInputs";
export {
  BudgetActualRow,
  BudgetActualSummary,
  BudgetVarianceCard,
  MemoBudgetActualRow,
  MemoBudgetActualSummary,
  ShortKInputSection,
} from "./ShortKBudgetComponents";



export function latestByMonth<T extends { month: string }>(rows: T[]) {
  return [...rows].sort((a, b) => b.month.localeCompare(a.month))[0];
}

export function monthlyRows(rows: MonthlyRecord[]) {
  return [...rows].sort((a, b) => a.month.localeCompare(b.month));
}

export function investmentsByAccounts(rows: InvestmentRecord[], accounts: string[]) {
  return rows.filter((row) => accounts.includes(row.account));
}

export function latestInvestmentRows(rows: InvestmentRecord[]) {
  const map = new Map<string, InvestmentRecord>();
  [...rows]
    .sort((a, b) => a.month.localeCompare(b.month))
    .forEach((row) => map.set(row.account, row));
  return Array.from(map.values());
}

export function readLocalStorage(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocalStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage failures
  }
}

export type ShortKBudget = {
  cashPrediction: number;
  incomeCashBudget: number;
  incomeInvestmentBudget: number;
  outgoBudget: number;
  fundInvestmentBudget: number;
  activeInvestmentBudget: number;
  usdInvestmentBudget: number;
};

export type ShortKActuals = {
  incomeCash: number;
  incomeInvestment: number;
  outgoCash: number;
  outgoPaypay: number;
  outgoCard: number;
  fundInvestment: number;
  activeInvestment: number;
  usdInvestment: number;
};

export const emptyShortKActuals: ShortKActuals = {
  incomeCash: 0,
  incomeInvestment: 0,
  outgoCash: 0,
  outgoPaypay: 0,
  outgoCard: 0,
  fundInvestment: 0,
  activeInvestment: 0,
  usdInvestment: 0,
};

export const SHORT_K_BUDGETS: Record<string, ShortKBudget> = {
  "2024-09": {
    cashPrediction: 1479881,
    incomeCashBudget: 1100000,
    incomeInvestmentBudget: 0,
    outgoBudget: 100000,
    fundInvestmentBudget: 0,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2024-10": {
    cashPrediction: 3305980,
    incomeCashBudget: 0,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 0,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2024-11": {
    cashPrediction: 2004077,
    incomeCashBudget: 30000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 0,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2024-12": {
    cashPrediction: 778193,
    incomeCashBudget: 30000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 0,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2025-01": {
    cashPrediction: 1949043,
    incomeCashBudget: 30000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 1300000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2025-02": {
    cashPrediction: 1508459,
    incomeCashBudget: 30000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2025-03": {
    cashPrediction: 1013403,
    incomeCashBudget: 30000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2025-04": {
    cashPrediction: 840982,
    incomeCashBudget: 30000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2025-05": {
    cashPrediction: 340113,
    incomeCashBudget: 40000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 100,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2025-06": {
    cashPrediction: 322719,
    incomeCashBudget: 40000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 100,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2025-07": {
    cashPrediction: 235285,
    incomeCashBudget: 40000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 100,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2025-08": {
    cashPrediction: 631536,
    incomeCashBudget: 40000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 100,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2025-09": {
    cashPrediction: 1276532,
    incomeCashBudget: 1140000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 100000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2025-10": {
    cashPrediction: 1171825,
    incomeCashBudget: 40000,
    incomeInvestmentBudget: 0,
    outgoBudget: 80000,
    fundInvestmentBudget: 100000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2025-11": {
    cashPrediction: 1774078,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 50000,
    outgoBudget: 90000,
    fundInvestmentBudget: 0,
    activeInvestmentBudget: 100000,
    usdInvestmentBudget: 0,
  },
  "2025-12": {
    cashPrediction: 1756392,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 50000,
    outgoBudget: 90000,
    fundInvestmentBudget: 0,
    activeInvestmentBudget: 100000,
    usdInvestmentBudget: 0,
  },
  "2026-01": {
    cashPrediction: 1460291,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 50000,
    outgoBudget: 90000,
    fundInvestmentBudget: 150000,
    activeInvestmentBudget: 150000,
    usdInvestmentBudget: 0,
  },
  "2026-02": {
    cashPrediction: 495030,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 50000,
    outgoBudget: 90000,
    fundInvestmentBudget: 60000,
    activeInvestmentBudget: 30000,
    usdInvestmentBudget: 1000000,
  },
  "2026-03": {
    cashPrediction: 271789,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 50000,
    outgoBudget: 90000,
    fundInvestmentBudget: -466412,
    activeInvestmentBudget: -198203,
    usdInvestmentBudget: 800000,
  },
  "2026-04": {
    cashPrediction: 1119583,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 50000,
    outgoBudget: 90000,
    fundInvestmentBudget: -799800,
    activeInvestmentBudget: 200,
    usdInvestmentBudget: 0,
  },
  "2026-05": {
    cashPrediction: 1077241,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 50000,
    outgoBudget: 90000,
    fundInvestmentBudget: 100,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2026-06": {
    cashPrediction: 339376,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 50000,
    outgoBudget: 90000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 1500000,
    usdInvestmentBudget: -800000,
  },
  "2026-07": {
    cashPrediction: 362475,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 300000,
    outgoBudget: 90000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2026-08": {
    cashPrediction: 272475,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 0,
    outgoBudget: 90000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2026-09": {
    cashPrediction: 782475,
    incomeCashBudget: 1150000,
    incomeInvestmentBudget: 0,
    outgoBudget: 90000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 500000,
    usdInvestmentBudget: 0,
  },
  "2026-10": {
    cashPrediction: 692475,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 0,
    outgoBudget: 90000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2026-11": {
    cashPrediction: 602475,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 0,
    outgoBudget: 90000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2026-12": {
    cashPrediction: 102475,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 0,
    outgoBudget: 500000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2027-01": {
    cashPrediction: 12475,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 0,
    outgoBudget: 90000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2027-02": {
    cashPrediction: -77525,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 0,
    outgoBudget: 90000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2027-03": {
    cashPrediction: -167525,
    incomeCashBudget: 50000,
    incomeInvestmentBudget: 0,
    outgoBudget: 90000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2027-04": {
    cashPrediction: -337525,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 300000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2027-05": {
    cashPrediction: -387525,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2027-06": {
    cashPrediction: -437525,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2027-07": {
    cashPrediction: -182634,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 304891,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2027-08": {
    cashPrediction: -232634,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2027-09": {
    cashPrediction: -182634,
    incomeCashBudget: 1280000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 1000000,
    usdInvestmentBudget: 0,
  },
  "2027-10": {
    cashPrediction: -232634,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2027-11": {
    cashPrediction: -282634,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2027-12": {
    cashPrediction: -332634,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2028-01": {
    cashPrediction: 409846,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 1000000,
    usdInvestmentBudget: -1792480,
  },
  "2028-02": {
    cashPrediction: 359846,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2028-03": {
    cashPrediction: 309846,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2028-04": {
    cashPrediction: 259846,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2028-05": {
    cashPrediction: 209846,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2028-06": {
    cashPrediction: 159846,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2028-07": {
    cashPrediction: 607840,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 497995,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2028-08": {
    cashPrediction: 557840,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2028-09": {
    cashPrediction: 607840,
    incomeCashBudget: 1280000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 1000000,
    usdInvestmentBudget: 0,
  },
  "2028-10": {
    cashPrediction: 557840,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2028-11": {
    cashPrediction: 507840,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2028-12": {
    cashPrediction: 457840,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-01": {
    cashPrediction: 407840,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-02": {
    cashPrediction: 357840,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-03": {
    cashPrediction: 307840,
    incomeCashBudget: 180000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-04": {
    cashPrediction: 277840,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-05": {
    cashPrediction: 247840,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-06": {
    cashPrediction: 217840,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-07": {
    cashPrediction: 881316,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 693476,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-08": {
    cashPrediction: 851316,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-09": {
    cashPrediction: 1921316,
    incomeCashBudget: 1300000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-10": {
    cashPrediction: 1891316,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-11": {
    cashPrediction: 1861316,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2029-12": {
    cashPrediction: 1831316,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 180000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-01": {
    cashPrediction: 1756316,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-02": {
    cashPrediction: 1681316,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-03": {
    cashPrediction: 1606316,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-04": {
    cashPrediction: 1531316,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-05": {
    cashPrediction: 1456316,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-06": {
    cashPrediction: 1381316,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-07": {
    cashPrediction: 2185306,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 878990,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-08": {
    cashPrediction: 2110306,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-09": {
    cashPrediction: 3135306,
    incomeCashBudget: 1300000,
    incomeInvestmentBudget: 0,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-10": {
    cashPrediction: 3060306,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-11": {
    cashPrediction: 2985306,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2030-12": {
    cashPrediction: 2910306,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 225000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2031-01": {
    cashPrediction: 305306,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 2755000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2031-02": {
    cashPrediction: 200306,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 255000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2031-03": {
    cashPrediction: 95306,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 255000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2031-04": {
    cashPrediction: -9694,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 255000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2031-05": {
    cashPrediction: -114694,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 255000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
  "2031-06": {
    cashPrediction: -219694,
    incomeCashBudget: 200000,
    incomeInvestmentBudget: 0,
    outgoBudget: 255000,
    fundInvestmentBudget: 50000,
    activeInvestmentBudget: 0,
    usdInvestmentBudget: 0,
  },
};

export function currentMonthString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function inMonthRange(month: string, start = SHORT_K_START, end = SHORT_K_END) {
  return month >= start && month <= end;
}

export function displayMonth(month: string) {
  const [year, monthNumber] = month.split("-");
  return `${year}/${Number(monthNumber)}`;
}

export function monthsBetween(start: string, end: string) {
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  const months: string[] = [];
  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

export function blankMonthly(month: string): MonthlyRecord {
  return { ...newMonthlyRecord(), id: `draft-${month}`, month };
}

export function monthlyForMonth(rows: MonthlyRecord[], month: string) {
  return rows.find((row) => row.month === month) ?? blankMonthly(month);
}

export function previousMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function parseShortKBudgetOverrides(
  row?: MonthlyRecord,
): Partial<ShortKBudget> {
  if (!row?.note) return {};
  try {
    const parsed = JSON.parse(row.note);
    const values = parsed?.shortKBudgetOverrides;
    if (!values || typeof values !== "object") return {};

    const overrides: Partial<ShortKBudget> = {};
    const keys: (keyof ShortKBudget)[] = [
      "cashPrediction",
      "incomeCashBudget",
      "incomeInvestmentBudget",
      "outgoBudget",
      "fundInvestmentBudget",
      "activeInvestmentBudget",
      "usdInvestmentBudget",
    ];

    keys.forEach((key) => {
      if (values[key] !== undefined && values[key] !== null && values[key] !== "") {
        overrides[key] = n(values[key]);
      }
    });

    return overrides;
  } catch {
    return {};
  }
}

export function shortKBudget(month: string, row?: MonthlyRecord): ShortKBudget {
  if (row?.user_key === "secondary") {
    return {
      cashPrediction: 0,
      incomeCashBudget: 0,
      incomeInvestmentBudget: 0,
      outgoBudget: 0,
      fundInvestmentBudget: 0,
      activeInvestmentBudget: 0,
      usdInvestmentBudget: 0,
    };
  }
  const fallback = SHORT_K_BUDGETS[SHORT_K_BUDGET_FALLBACK_MONTH];
  const base = SHORT_K_BUDGETS[month] ?? {
    ...fallback,
    cashPrediction: row?.cash_prediction ?? fallback.cashPrediction,
    incomeCashBudget: row?.income_budget ?? fallback.incomeCashBudget,
    outgoBudget: row?.outgo_budget ?? fallback.outgoBudget,
    fundInvestmentBudget: row?.invest_budget ?? fallback.fundInvestmentBudget,
  };

  return { ...base, ...parseShortKBudgetOverrides(row) };
}

export function parseShortKActuals(row?: MonthlyRecord): ShortKActuals {
  if (!row?.note) return { ...emptyShortKActuals };
  try {
    const parsed = JSON.parse(row.note);
    const values = parsed?.shortKActuals ?? parsed;
    return {
      incomeCash: n(values.incomeCash),
      incomeInvestment: n(values.incomeInvestment),
      outgoCash: n(values.outgoCash),
      outgoPaypay: n(values.outgoPaypay),
      outgoCard: n(values.outgoCard),
      fundInvestment: n(values.fundInvestment),
      activeInvestment: n(values.activeInvestment),
      usdInvestment: n(values.usdInvestment),
    };
  } catch {
    return { ...emptyShortKActuals };
  }
}

export function buildShortKNote(
  row: MonthlyRecord | undefined,
  actuals: ShortKActuals,
  budgetOverrides?: Partial<ShortKBudget>,
) {
  let base: Record<string, unknown> = {};
  if (row?.note) {
    try {
      const parsed = JSON.parse(row.note);
      if (parsed && typeof parsed === "object") base = parsed;
    } catch {
      base = {};
    }
  }
  const existingBudgetOverrides = parseShortKBudgetOverrides(row);
  return JSON.stringify({
    ...base,
    shortKActuals: actuals,
    shortKBudgetOverrides: {
      ...existingBudgetOverrides,
      ...(budgetOverrides ?? {}),
    },
  });
}

export function hasShortKActuals(actuals: ShortKActuals) {
  return Object.values(actuals).some((value) => value !== 0);
}

export function shortKIncomeTotal(actuals: ShortKActuals) {
  return actuals.incomeCash + actuals.incomeInvestment;
}

export function shortKOutgoTotal(
  actuals: ShortKActuals,
  previousActuals?: ShortKActuals,
) {
  return (
    actuals.outgoCash + actuals.outgoPaypay + (previousActuals?.outgoCard ?? 0)
  );
}

export function shortKInvestmentTotal(actuals: ShortKActuals) {
  return (
    actuals.fundInvestment + actuals.activeInvestment + actuals.usdInvestment
  );
}

export function shortKBudgetIncomeTotal(budget: ShortKBudget) {
  return budget.incomeCashBudget + budget.incomeInvestmentBudget;
}

export function shortKBudgetInvestmentTotal(budget: ShortKBudget) {
  return (
    budget.fundInvestmentBudget +
    budget.activeInvestmentBudget +
    budget.usdInvestmentBudget
  );
}

export function shortKBudgetDelta(
  month: string,
  row?: MonthlyRecord,
  zeroFallback = false,
) {
  const budget = zeroFallback && !row
    ? shortKBudget(month, { ...blankMonthly(month), user_key: "secondary" })
    : shortKBudget(month, row);
  return (
    shortKBudgetIncomeTotal(budget) -
    budget.outgoBudget -
    shortKBudgetInvestmentTotal(budget)
  );
}

export function shortKActualDelta(
  actuals: ShortKActuals,
  previousActuals?: ShortKActuals,
) {
  return (
    shortKIncomeTotal(actuals) -
    shortKOutgoTotal(actuals, previousActuals) -
    shortKInvestmentTotal(actuals)
  );
}

export function shortKCalculatedDeposit(month: string, rows: MonthlyRecord[]): number {
  let balance = shortKBaseCash(rows);
  const zeroFallback = rows.some((row) => row.user_key === "secondary");
  const months = monthsBetween(SHORT_K_START, month);

  for (const currentMonth of months) {
    const row = rows.find((item) => item.month === currentMonth);
    const actuals = parseShortKActuals(row);
    const previousRow = rows.find(
      (item) => item.month === previousMonth(currentMonth),
    );
    const previousActuals = parseShortKActuals(previousRow);

    balance +=
      row && hasShortKActuals(actuals)
        ? shortKActualDelta(actuals, previousActuals)
        : shortKBudgetDelta(currentMonth, row, zeroFallback);
  }

  return balance;
}

export function canCalculateShortKDeposit(month: string, rows: MonthlyRecord[]) {
  if (month === SHORT_K_START) return true;
  const previous = rows.find((row) => row.month === previousMonth(month));
  return Boolean(previous && isShortKEntered(previous));
}

export function actualAccount(row: MonthlyRecord) {
  const actuals = parseShortKActuals(row);
  return shortKInvestmentTotal(actuals);
}

export function predictedAccount(row: MonthlyRecord, detailRows: InvestmentRecord[]) {
  const investmentPrediction = SHORT_K_ACCOUNTS.reduce((sum, account) => {
    const investment = detailRows.find(
      (item) => item.month === row.month && item.account === account,
    );
    return sum + (investment?.predicted_balance ?? 0);
  }, 0);
  return investmentPrediction + row.usd_capital;
}

export function isShortKEntered(row: MonthlyRecord) {
  return hasShortKActuals(parseShortKActuals(row));
}

export function latestEnteredShortKMonth(rows: MonthlyRecord[]) {
  const entered = rows
    .filter((row) => inMonthRange(row.month) && isShortKEntered(row))
    .map((row) => row.month)
    .sort();
  return entered.at(-1);
}

export function shortKProjectedBalance(
  month: string,
  rows: MonthlyRecord[],
  latestEnteredMonth?: string,
) {
  const startBalance = latestEnteredMonth
    ? shortKCalculatedDeposit(latestEnteredMonth, rows)
    : shortKBaseCash(rows);
  const startMonth = latestEnteredMonth
    ? nextMonth(latestEnteredMonth)
    : SHORT_K_START;

  let balance = startBalance;
  const zeroFallback = rows.some((row) => row.user_key === "secondary");
  for (const currentMonth of monthsBetween(startMonth, month)) {
    const row = rows.find((item) => item.month === currentMonth);
    balance += shortKBudgetDelta(currentMonth, row, zeroFallback);
  }
  return balance;
}

export function nextMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}


export type ShortKAssetAccountKey = "fund" | "active" | "usd";
export type ShortKAnnualReturnRates = Record<ShortKAssetAccountKey, number>;

export const DEFAULT_SHORT_K_ANNUAL_RETURN_RATES: ShortKAnnualReturnRates = {
  fund: 0.15,
  active: 0.18,
  usd: 0.1,
};

export const SHORT_K_ASSET_ACCOUNTS: Record<
  ShortKAssetAccountKey,
  {
    label: string;
    account: string;
    actualKey: keyof ShortKActuals;
    budgetKey: keyof Pick<
      ShortKBudget,
      "fundInvestmentBudget" | "activeInvestmentBudget" | "usdInvestmentBudget"
    >;
    annualRate: number;
  }
> = {
  fund: {
    label: "投資信託口座",
    account: "投資信託口座",
    actualKey: "fundInvestment",
    budgetKey: "fundInvestmentBudget",
    annualRate: 0.15,
  },
  active: {
    label: "アクティブ口座",
    account: "アクティブ口座",
    actualKey: "activeInvestment",
    budgetKey: "activeInvestmentBudget",
    annualRate: 0.18,
  },
  usd: {
    label: "FX口座",
    account: "FX口座",
    actualKey: "usdInvestment",
    budgetKey: "usdInvestmentBudget",
    annualRate: 0.1,
  },
};

export function shortKAssetAccountAliases(account: string) {
  return account === "FX口座" ? ["FX口座", "USD口座"] : [account];
}

export function shortKAssetRowMatches(row: InvestmentRecord, account: string) {
  return shortKAssetAccountAliases(account).includes(row.account);
}

export function getShortKAssetRows(rows: InvestmentRecord[], month: string) {
  const accounts = Object.values(SHORT_K_ASSET_ACCOUNTS).flatMap(
    (config) => shortKAssetAccountAliases(config.account),
  );
  return rows.filter((row) => row.month === month && accounts.includes(row.account));
}

export function shortKAccountPrincipal(
  accountKey: ShortKAssetAccountKey,
  month: string,
  rows: MonthlyRecord[],
  detailRows: InvestmentRecord[] = [],
  annualReturnRates: Partial<ShortKAnnualReturnRates> = DEFAULT_SHORT_K_ANNUAL_RETURN_RATES,
) {
  if (!month || month <= SHORT_K_BASE_MONTH) return 0;
  const config = SHORT_K_ASSET_ACCOUNTS[accountKey];
  let principal = 0;
  let previousValue = 0;

  for (const currentMonth of monthsBetween(SHORT_K_START, month)) {
    const row = rows.find((item) => item.month === currentMonth);
    const actuals = parseShortKActuals(row);
    const budget = shortKBudget(currentMonth, row);
    const deposit = row && hasShortKActuals(actuals)
      ? actuals[config.actualKey]
      : n(budget[config.budgetKey]);

    if (deposit >= 0) {
      principal += deposit;
    } else {
      const withdrawal = Math.abs(deposit);
      const basisValue = Math.max(previousValue, principal);
      const principalRatio = basisValue > 0 ? Math.min(1, Math.max(0, principal / basisValue)) : 1;
      principal = Math.max(0, principal - withdrawal * principalRatio);
    }

    const enteredValue = shortKAccountEvaluation(accountKey, currentMonth, detailRows);
    if (enteredValue) {
      previousValue = enteredValue;
    } else {
      const baseValue = previousValue || principal;
      previousValue = baseValue * (1 + shortKAccountMonthlyRate(accountKey, annualReturnRates)) + Math.max(deposit, 0);
    }
  }

  return principal;
}

export function shortKAccountMonthlyRate(
  accountKey: ShortKAssetAccountKey,
  annualReturnRates: Partial<ShortKAnnualReturnRates> = DEFAULT_SHORT_K_ANNUAL_RETURN_RATES,
) {
  const annualRate = Number.isFinite(annualReturnRates[accountKey])
    ? Number(annualReturnRates[accountKey])
    : SHORT_K_ASSET_ACCOUNTS[accountKey].annualRate;
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

export function shortKAccountDepositForMonth(
  accountKey: ShortKAssetAccountKey,
  month: string,
  rows: MonthlyRecord[],
) {
  const config = SHORT_K_ASSET_ACCOUNTS[accountKey];
  const row = rows.find((item) => item.month === month);
  const actuals = parseShortKActuals(row);
  const budget = shortKBudget(month, row);
  return row && hasShortKActuals(actuals)
    ? actuals[config.actualKey]
    : n(budget[config.budgetKey]);
}

export function shortKAccountEvaluation(
  accountKey: ShortKAssetAccountKey,
  month: string,
  detailRows: InvestmentRecord[],
) {
  const account = SHORT_K_ASSET_ACCOUNTS[accountKey].account;
  const row = detailRows.find(
    (item) => item.month === month && shortKAssetRowMatches(item, account),
  );
  return row?.actual_balance || 0;
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
    const enteredValue = shortKAccountEvaluation(
      accountKey,
      currentMonth,
      detailRows,
    );
    const baseValue = enteredValue || previousValue;
    const deposit = shortKAccountDepositForMonth(accountKey, currentMonth, rows);
    const predictedValue = baseValue * (1 + shortKAccountMonthlyRate(accountKey, annualReturnRates)) + deposit;
    previousValue = enteredValue || predictedValue;
  }

  return previousValue;
}

export function shortKAssetSummary(
  month: string,
  rows: MonthlyRecord[],
  detailRows: InvestmentRecord[],
  annualReturnRates: Partial<ShortKAnnualReturnRates> = DEFAULT_SHORT_K_ANNUAL_RETURN_RATES,
) {
  return (Object.keys(SHORT_K_ASSET_ACCOUNTS) as ShortKAssetAccountKey[]).reduce(
    (summary, key) => {
      const principal = shortKAccountPrincipal(key, month, rows, detailRows, annualReturnRates);
      const evaluation = shortKAccountEvaluation(key, month, detailRows);
      const predicted = shortKAccountPredictedValue(key, month, rows, detailRows, annualReturnRates);
      const value = evaluation || predicted;
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
  return (Object.keys(SHORT_K_ASSET_ACCOUNTS) as ShortKAssetAccountKey[]).reduce(
    (summary, key) => {
      const principal = shortKAccountPrincipal(key, month, rows, detailRows);
      const evaluation = shortKAccountEvaluation(key, month, detailRows);
      return {
        principal: summary.principal + principal,
        value: summary.value + evaluation,
        profit: summary.profit + (principal > 0 ? evaluation - principal : 0),
        hasEvaluation: summary.hasEvaluation || evaluation !== 0,
      };
    },
    { principal: 0, value: 0, profit: 0, hasEvaluation: false },
  );
}

export function shortKInvestmentIncomeCumulative(
  month: string,
  rows: MonthlyRecord[],
  useBudgetForFuture = false,
) {
  const zeroFallback = rows.some((row) => row.user_key === "secondary");
  return monthsBetween(SHORT_K_START, month).reduce((sum, currentMonth) => {
    const row = rows.find((item) => item.month === currentMonth);
    const actuals = parseShortKActuals(row);
    if (row && hasShortKActuals(actuals)) {
      return sum + actuals.incomeInvestment;
    }
    if (useBudgetForFuture) {
      if (zeroFallback) return sum;
      return sum + shortKBudget(currentMonth, row).incomeInvestmentBudget;
    }
    return sum;
  }, 0);
}

export function shortKTotalInvestmentProfit(
  month: string,
  rows: MonthlyRecord[],
  detailRows: InvestmentRecord[],
) {
  const summary = shortKAssetActualSummary(month, rows, detailRows);
  return summary.hasEvaluation
    ? summary.value - summary.principal - shortKInitialInvestmentProfit(rows) +
      shortKInvestmentIncomeCumulative(month, rows)
    : undefined;
}

export function shortKAdjustedAssetSummary(
  month: string,
  rows: MonthlyRecord[],
  detailRows: InvestmentRecord[],
  annualReturnRates: Partial<ShortKAnnualReturnRates> = DEFAULT_SHORT_K_ANNUAL_RETURN_RATES,
) {
  const summary = shortKAssetSummary(month, rows, detailRows, annualReturnRates);
  return {
    ...summary,
    profit: summary.value > 0
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
  const rowByMonth = new Map(sortedRows.map((row) => [row.month, row]));
  const evaluationByKey = new Map<string, number>();

  detailRows.forEach((row) => {
    (Object.keys(SHORT_K_ASSET_ACCOUNTS) as ShortKAssetAccountKey[]).forEach((key) => {
      if (shortKAssetRowMatches(row, SHORT_K_ASSET_ACCOUNTS[key].account)) {
        evaluationByKey.set(`${key}:${row.month}`, row.actual_balance || 0);
      }
    });
  });

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
  let cumulativeProfitWithBudgetRunning = -initialInvestmentProfit;
  let previousInvestmentValueWithBudget = 0;

  const accountStates: Record<ShortKAssetAccountKey, { principal: number; previousValue: number }> = {
    fund: { principal: 0, previousValue: 0 },
    active: { principal: 0, previousValue: 0 },
    usd: { principal: 0, previousValue: 0 },
  };

  const rawRows = allMonths.map((month) => {
    const row = rowByMonth.get(month);
    const actuals = parseShortKActuals(row);
    const isEntered = Boolean(row && hasShortKActuals(actuals));
    const previousRow = rowByMonth.get(previousMonth(month));
    const previousActuals = parseShortKActuals(previousRow);

    const zeroFallback = sortedRows.some((item) => item.user_key === "secondary");
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
      ? actuals.incomeInvestment
      : monthlyBudget.incomeInvestmentBudget;

    let actualInvestmentDeposit = 0;
    let actualInvestmentWithdrawal = 0;
    let investmentDepositWithBudget = 0;
    let investmentWithdrawalWithBudget = 0;

    let actualPrincipal = 0;
    let actualValue = 0;
    let actualProfit = 0;
    let hasEvaluation = false;
    let summaryPrincipal = 0;
    let summaryValue = 0;
    let summaryProfit = 0;

    (Object.keys(SHORT_K_ASSET_ACCOUNTS) as ShortKAssetAccountKey[]).forEach((key) => {
      const state = accountStates[key];
      const config = SHORT_K_ASSET_ACCOUNTS[key];
      const deposit = isEntered ? actuals[config.actualKey] : n(monthlyBudget[config.budgetKey]);

      if (isEntered) {
        if (actuals[config.actualKey] >= 0) {
          actualInvestmentDeposit += actuals[config.actualKey];
        } else {
          actualInvestmentWithdrawal += Math.abs(actuals[config.actualKey]);
        }
      }

      if (deposit >= 0) {
        investmentDepositWithBudget += deposit;
      } else {
        investmentWithdrawalWithBudget += Math.abs(deposit);
      }

      if (deposit >= 0) {
        state.principal += deposit;
      } else {
        const withdrawal = Math.abs(deposit);
        const basisValue = Math.max(state.previousValue, state.principal);
        const principalRatio = basisValue > 0 ? Math.min(1, Math.max(0, state.principal / basisValue)) : 1;
        state.principal = Math.max(0, state.principal - withdrawal * principalRatio);
      }

      const evaluation = evaluationByKey.get(`${key}:${month}`) ?? 0;
      const baseValue = evaluation || state.previousValue;
      const predicted = baseValue * (1 + shortKAccountMonthlyRate(key, annualReturnRates)) + deposit;
      state.previousValue = evaluation || predicted;

      actualPrincipal += state.principal;
      actualValue += evaluation;
      actualProfit += state.principal > 0 ? evaluation - state.principal : 0;
      hasEvaluation = hasEvaluation || evaluation !== 0;

      const value = evaluation || state.previousValue;
      summaryPrincipal += state.principal;
      summaryValue += value;
      summaryProfit += value - state.principal;
    });

    let totalActualProfit: number | undefined;
    if (hasEvaluation) {
      cumulativeProfitActualRunning +=
        (actualValue - previousActualInvestmentValue) -
        actualInvestmentDeposit +
        actualInvestmentWithdrawal +
        actuals.incomeInvestment;
      previousActualInvestmentValue = actualValue;
      totalActualProfit = cumulativeProfitActualRunning;
    }

    cumulativeProfitWithBudgetRunning +=
      (summaryValue - previousInvestmentValueWithBudget) -
      investmentDepositWithBudget +
      investmentWithdrawalWithBudget +
      investmentIncomeForProfit;
    previousInvestmentValueWithBudget = summaryValue;

    const adjustedProfit = summaryValue > 0 ? cumulativeProfitWithBudgetRunning : 0;

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
      assetActual: isEntered ? cashBalance + summaryValue : undefined,
      assetPrediction: (latestEnteredMonth ? month >= latestEnteredMonth : true)
        ? projectedBalance + summaryValue
        : undefined,
      cumulativeProfitActual: hasEvaluation ? totalActualProfit : undefined,
      cumulativeProfitPrediction: undefined as number | undefined,
      __hasEvaluation: hasEvaluation,
      __adjustedProfit: adjustedProfit,
    };
  });

  const latestProfit = [...rawRows]
    .reverse()
    .find((row) => row.__hasEvaluation && row.cumulativeProfitActual !== undefined);
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

    const { __hasEvaluation, __adjustedProfit, ...publicRow } = row;
    return { ...publicRow, cumulativeProfitPrediction };
  });
}

export function shortKYearOptions() {
  const [startYear] = SHORT_K_START.split("-").map(Number);
  const [endYear] = SHORT_K_END.split("-").map(Number);
  return Array.from({ length: endYear - startYear + 1 }, (_, index) =>
    String(startYear + index),
  );
}

export function shortKMonthOptions(year: string) {
  if (!year) return [];
  return Array.from({ length: 12 }, (_, index) =>
    String(index + 1).padStart(2, "0"),
  ).filter((month) => {
    const value = `${year}-${month}`;
    return inMonthRange(value);
  });
}
