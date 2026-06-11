import type { FinanceState, MonthlyRecord } from "../types/finance";

const CLEANUP_KEY = "finance-planner-future-actuals-cleaned-2026-07-v1";
const CUTOFF_MONTH = "2026-07";

function clearMonthlyActuals(row: MonthlyRecord): MonthlyRecord {
  if (row.month < CUTOFF_MONTH) return row;

  let note = row.note;
  if (typeof note === "string" && note.trim()) {
    try {
      const parsed = JSON.parse(note) as {
        shortKActuals?: Record<string, number>;
        [key: string]: unknown;
      };
      note = JSON.stringify({
        ...parsed,
        shortKActuals: {
          ...(parsed.shortKActuals ?? {}),
          incomeCash: 0,
          incomeInvestment: 0,
          outgoCash: 0,
          outgoPaypay: 0,
          outgoCard: 0,
          fundInvestment: 0,
          activeInvestment: 0,
          usdInvestment: 0,
        },
      });
    } catch {
      // Preserve notes that are not structured app data.
    }
  }

  return {
    ...row,
    cash_actual: 0,
    income_actual: 0,
    outgo_cash: 0,
    outgo_card: 0,
    outgo_other: 0,
    invest_actual: 0,
    usd_actual: 0,
    note,
  };
}

export function shouldClearFutureActuals() {
  return (
    typeof window !== "undefined" &&
    window.localStorage.getItem(CLEANUP_KEY) !== "done"
  );
}

export function clearFutureActuals(state: FinanceState): FinanceState {
  return {
    ...state,
    monthly: state.monthly.map(clearMonthlyActuals),
    investments: state.investments.map((row) =>
      row.month < CUTOFF_MONTH ? row : { ...row, actual_balance: 0 },
    ),
    fxTrades: state.fxTrades.filter(
      (row) => row.date.slice(0, 7) < CUTOFF_MONTH,
    ),
  };
}

export function markFutureActualsCleared() {
  window.localStorage.setItem(CLEANUP_KEY, "done");
}
