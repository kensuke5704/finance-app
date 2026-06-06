import { supabase } from "./supabase";
import type {
  FinanceState,
  FundRecord,
  FxRiskInput,
  FxTrade,
  InvestmentRecord,
  MonthlyRecord,
  TickerHolding,
} from "../types/finance";

const USER_KEY = "personal";
const STORAGE_KEY = "finance-planner-state-v1";
const BACKUP_KEY = "finance-planner-state-v1-backup";
const LAST_GOOD_KEY = "finance-planner-state-v1-last-good";

export const investmentAccounts = [
  "WealthNavi",
  "ROBOPRO",
  "INDEX",
  "Active",
  "NISA",
  "NASDAQ100",
];
export const fundNames = ["eMAXIS Neo 宇宙開発", "ROBOPRO ファンド", "mega10"];

const id = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const defaultState: FinanceState = {
  monthly: [
    {
      id: id(),
      user_key: USER_KEY,
      month: "2026-01",
      age: 25,
      cash_prediction: 803596,
      cash_actual: 0,
      income_budget: 50000,
      income_actual: 0,
      outgo_budget: 90000,
      outgo_cash: 0,
      outgo_card: 0,
      outgo_other: 0,
      invest_budget: 300000,
      invest_actual: 0,
      usd_capital: 1000000,
      usd_actual: 0,
      note: "Finance.xlsmの月次資産計画をWeb化",
    },
    {
      id: id(),
      user_key: USER_KEY,
      month: "2026-02",
      age: 25,
      cash_prediction: 2329481,
      cash_actual: 0,
      income_budget: 1140000,
      income_actual: 0,
      outgo_budget: 80000,
      outgo_cash: 0,
      outgo_card: 0,
      outgo_other: 0,
      invest_budget: 100000,
      invest_actual: 0,
      usd_capital: 1000000,
      usd_actual: 0,
      note: null,
    },
  ],
  investments: [
    {
      id: id(),
      user_key: USER_KEY,
      month: "2026-01",
      account: "ROBOPRO",
      deposit: 50000,
      withdrawal: 0,
      capital: 560200,
      predicted_balance: 762911,
      actual_balance: 0,
      monthly_return_rate: 0.0095,
      note: null,
    },
    {
      id: id(),
      user_key: USER_KEY,
      month: "2026-01",
      account: "Active",
      deposit: 0,
      withdrawal: 0,
      capital: 1681997,
      predicted_balance: 1756463,
      actual_balance: 0,
      monthly_return_rate: 0.01465,
      note: null,
    },
  ],
  funds: [
    {
      id: id(),
      user_key: USER_KEY,
      date: "2026-06-03",
      name: "eMAXIS Neo 宇宙開発",
      price: 64599,
      change_amount: -3401,
      nav_million: 71112,
      units: 49766,
    },
    {
      id: id(),
      user_key: USER_KEY,
      date: "2026-06-03",
      name: "ROBOPRO ファンド",
      price: 15591,
      change_amount: -36,
      nav_million: 421084,
      units: 477209,
    },
    {
      id: id(),
      user_key: USER_KEY,
      date: "2026-06-03",
      name: "mega10",
      price: 11120,
      change_amount: -12,
      nav_million: 64524,
      units: 205248,
    },
  ],
  tickers: [
    { id: id(), user_key: USER_KEY, ticker: "SOXL", price: 164.18, shares: 0 },
    { id: id(), user_key: USER_KEY, ticker: "LUNR", price: 33.89, shares: 0 },
    { id: id(), user_key: USER_KEY, ticker: "RKLB", price: 124.77, shares: 0 },
    { id: id(), user_key: USER_KEY, ticker: "VRT", price: 370.94, shares: 0 },
  ],
  fxTrades: [
    { id: id(), user_key: USER_KEY, date: "2026-01-03", result: 800, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-01-24", result: 20560, memo: null },
    { id: id(), user_key: USER_KEY, date: "2026-02-24", result: 20106, memo: "latest" },
  ],
  fxRisk: {
    id: id(),
    user_key: USER_KEY,
    margin: 1603056,
    units: 180000,
    contract_rate: 154.673,
    current_rate: 155,
    leverage: 10,
    swap_per_unit: -140,
    holding_days: 0,
    extra_margin: 800000,
  },
};

function normalizeState(raw: Partial<FinanceState> | null | undefined): FinanceState {
  const state = raw ?? {};
  return {
    ...defaultState,
    ...state,
    monthly: Array.isArray(state.monthly) ? state.monthly : defaultState.monthly,
    investments: Array.isArray(state.investments) ? state.investments : defaultState.investments,
    funds: Array.isArray(state.funds) ? state.funds : defaultState.funds,
    tickers: Array.isArray(state.tickers) ? state.tickers : defaultState.tickers,
    fxTrades: Array.isArray(state.fxTrades) ? state.fxTrades : defaultState.fxTrades,
    fxRisk: state.fxRisk ?? defaultState.fxRisk,
  } as FinanceState;
}

function stateScore(state: FinanceState) {
  return (
    state.monthly.length * 10 +
    state.investments.length * 4 +
    state.funds.length * 3 +
    state.tickers.length * 3 +
    state.fxTrades.length
  );
}

function isMeaningfulState(state: FinanceState) {
  return stateScore(state) > stateScore(defaultState) ||
    state.monthly.some((row) => row.cash_actual || row.income_actual || row.outgo_cash || row.outgo_card || row.outgo_other || row.invest_actual || row.usd_actual) ||
    state.investments.some((row) => row.actual_balance || row.deposit || row.withdrawal) ||
    state.funds.some((row) => row.units || row.price) ||
    state.tickers.some((row) => row.shares || row.price) ||
    state.fxTrades.some((row) => row.result);
}

function readLocalKey(key: string): FinanceState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return normalizeState(JSON.parse(raw) as Partial<FinanceState>);
  } catch {
    return null;
  }
}

function loadLocal(): FinanceState {
  const candidates = [STORAGE_KEY, BACKUP_KEY, LAST_GOOD_KEY]
    .map(readLocalKey)
    .filter((item): item is FinanceState => Boolean(item));
  if (!candidates.length) return defaultState;
  return candidates.sort((a, b) => stateScore(b) - stateScore(a))[0];
}

function saveLocal(state: FinanceState) {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(state);
  window.localStorage.setItem(STORAGE_KEY, serialized);
  window.localStorage.setItem(BACKUP_KEY, serialized);
  if (isMeaningfulState(state)) {
    window.localStorage.setItem(LAST_GOOD_KEY, serialized);
  }
}

function hasRemoteData(state: FinanceState) {
  return Boolean(
    state.monthly.length ||
      state.investments.length ||
      state.funds.length ||
      state.tickers.length ||
      state.fxTrades.length ||
      state.fxRisk,
  );
}

export async function loadFinanceState(): Promise<FinanceState> {
  const local = loadLocal();
  if (!supabase) return local;

  const [monthly, investments, funds, tickers, fxTrades, fxRiskRows] = await Promise.all([
    supabase.from("finance_monthly_records").select("*").eq("user_key", USER_KEY).order("month", { ascending: true }),
    supabase.from("finance_investment_records").select("*").eq("user_key", USER_KEY).order("month", { ascending: true }),
    supabase.from("finance_fund_records").select("*").eq("user_key", USER_KEY).order("date", { ascending: false }),
    supabase.from("finance_ticker_holdings").select("*").eq("user_key", USER_KEY).order("ticker", { ascending: true }),
    supabase.from("finance_fx_trades").select("*").eq("user_key", USER_KEY).order("date", { ascending: false }),
    supabase.from("finance_fx_risk_inputs").select("*").eq("user_key", USER_KEY).limit(1),
  ]);

  const error = monthly.error || investments.error || funds.error || tickers.error || fxTrades.error || fxRiskRows.error;
  if (error) throw error;

  const remoteState = normalizeState({
    monthly: (monthly.data ?? []) as MonthlyRecord[],
    investments: (investments.data ?? []) as InvestmentRecord[],
    funds: (funds.data ?? []) as FundRecord[],
    tickers: (tickers.data ?? []) as TickerHolding[],
    fxTrades: (fxTrades.data ?? []) as FxTrade[],
    fxRisk: (fxRiskRows.data?.[0] as FxRiskInput | undefined) ?? undefined,
  });

  if (hasRemoteData(remoteState) && stateScore(remoteState) >= stateScore(defaultState)) {
    saveLocal(remoteState);
    return remoteState;
  }

  if (isMeaningfulState(local)) {
    return local;
  }

  return defaultState;
}

async function syncTable<T extends { id: string; user_key: string }>(
  table: string,
  rows: T[],
) {
  if (!supabase) return;

  if (rows.length) {
    const { error: upsertError } = await supabase.from(table).upsert(rows, { onConflict: "id" });
    if (upsertError) throw upsertError;
  }

  const existing = await supabase.from(table).select("id").eq("user_key", USER_KEY);
  if (existing.error) throw existing.error;

  const nextIds = new Set(rows.map((row) => row.id));
  const idsToDelete = (existing.data ?? [])
    .map((row) => row.id as string)
    .filter((existingId) => !nextIds.has(existingId));

  if (idsToDelete.length) {
    const { error: deleteError } = await supabase.from(table).delete().in("id", idsToDelete);
    if (deleteError) throw deleteError;
  }
}

export async function persistFinanceState(state: FinanceState): Promise<void> {
  const normalized = normalizeState(state);
  saveLocal(normalized);

  if (!supabase) return;

  await syncTable("finance_monthly_records", normalized.monthly);
  await syncTable("finance_investment_records", normalized.investments);
  await syncTable("finance_fund_records", normalized.funds);
  await syncTable("finance_ticker_holdings", normalized.tickers);
  await syncTable("finance_fx_trades", normalized.fxTrades);

  const { error: fxRiskError } = await supabase
    .from("finance_fx_risk_inputs")
    .upsert(normalized.fxRisk, { onConflict: "id" });
  if (fxRiskError) throw fxRiskError;
}

export function newMonthlyRecord(): MonthlyRecord {
  const month = new Date().toISOString().slice(0, 7);
  return {
    id: id(), user_key: USER_KEY, month, age: 25, cash_prediction: 0, cash_actual: 0, income_budget: 0, income_actual: 0,
    outgo_budget: 0, outgo_cash: 0, outgo_card: 0, outgo_other: 0, invest_budget: 0, invest_actual: 0, usd_capital: 0, usd_actual: 0, note: null,
  };
}

export function newInvestmentRecord(): InvestmentRecord {
  const month = new Date().toISOString().slice(0, 7);
  return { id: id(), user_key: USER_KEY, month, account: "INDEX", deposit: 0, withdrawal: 0, capital: 0, predicted_balance: 0, actual_balance: 0, monthly_return_rate: 0.0095, note: null };
}

export function newFundRecord(): FundRecord {
  return { id: id(), user_key: USER_KEY, date: new Date().toISOString().slice(0, 10), name: fundNames[0], price: 0, change_amount: 0, nav_million: 0, units: 0 };
}

export function newTickerHolding(): TickerHolding {
  return { id: id(), user_key: USER_KEY, ticker: "", price: 0, shares: 0 };
}

export function newFxTrade(): FxTrade {
  return { id: id(), user_key: USER_KEY, date: new Date().toISOString().slice(0, 10), result: 0, memo: null };
}
