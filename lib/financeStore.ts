import { supabase } from "./supabase";
import type { FinanceState, FundRecord, FxRiskInput, FxTrade, InvestmentRecord, MonthlyRecord, TickerHolding } from "../types/finance";

const USER_KEY = "personal";
const STORAGE_KEY = "finance-planner-state-v1";

export const investmentAccounts = ["WealthNavi", "ROBOPRO", "INDEX", "Active", "NISA", "NASDAQ100"];
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

function loadLocal(): FinanceState {
  if (typeof window === "undefined") return defaultState;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState;
  try {
    return { ...defaultState, ...JSON.parse(raw) } as FinanceState;
  } catch {
    return defaultState;
  }
}

function saveLocal(state: FinanceState) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

export async function loadFinanceState(): Promise<FinanceState> {
  if (!supabase) return loadLocal();

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

  return {
    monthly: (monthly.data?.length ? monthly.data : defaultState.monthly) as MonthlyRecord[],
    investments: (investments.data?.length ? investments.data : defaultState.investments) as InvestmentRecord[],
    funds: (funds.data?.length ? funds.data : defaultState.funds) as FundRecord[],
    tickers: (tickers.data?.length ? tickers.data : defaultState.tickers) as TickerHolding[],
    fxTrades: (fxTrades.data?.length ? fxTrades.data : defaultState.fxTrades) as FxTrade[],
    fxRisk: ((fxRiskRows.data?.[0] as FxRiskInput | undefined) ?? defaultState.fxRisk),
  };
}

export async function persistFinanceState(state: FinanceState): Promise<void> {
  if (!supabase) {
    saveLocal(state);
    return;
  }

  await Promise.all([
    supabase.from("finance_monthly_records").delete().eq("user_key", USER_KEY),
    supabase.from("finance_investment_records").delete().eq("user_key", USER_KEY),
    supabase.from("finance_fund_records").delete().eq("user_key", USER_KEY),
    supabase.from("finance_ticker_holdings").delete().eq("user_key", USER_KEY),
    supabase.from("finance_fx_trades").delete().eq("user_key", USER_KEY),
    supabase.from("finance_fx_risk_inputs").delete().eq("user_key", USER_KEY),
  ]);

  const [monthly, investments, funds, tickers, fxTrades, fxRisk] = await Promise.all([
    state.monthly.length ? supabase.from("finance_monthly_records").insert(state.monthly) : Promise.resolve({ error: null }),
    state.investments.length ? supabase.from("finance_investment_records").insert(state.investments) : Promise.resolve({ error: null }),
    state.funds.length ? supabase.from("finance_fund_records").insert(state.funds) : Promise.resolve({ error: null }),
    state.tickers.length ? supabase.from("finance_ticker_holdings").insert(state.tickers) : Promise.resolve({ error: null }),
    state.fxTrades.length ? supabase.from("finance_fx_trades").insert(state.fxTrades) : Promise.resolve({ error: null }),
    supabase.from("finance_fx_risk_inputs").insert(state.fxRisk),
  ]);

  const error = monthly.error || investments.error || funds.error || tickers.error || fxTrades.error || fxRisk.error;
  if (error) throw error;
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
