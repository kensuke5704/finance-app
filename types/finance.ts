export type MonthlyRecord = {
  id: string;
  user_key: string;
  month: string;
  age: number;
  cash_prediction: number;
  cash_actual: number;
  income_budget: number;
  income_actual: number;
  outgo_budget: number;
  outgo_cash: number;
  outgo_card: number;
  outgo_other: number;
  invest_budget: number;
  invest_actual: number;
  usd_capital: number;
  usd_actual: number;
  note: string | null;
  created_at?: string;
};

export type InvestmentRecord = {
  id: string;
  user_key: string;
  month: string;
  account: string;
  deposit: number;
  withdrawal: number;
  capital: number;
  predicted_balance: number;
  actual_balance: number;
  monthly_return_rate: number;
  note: string | null;
  created_at?: string;
};

export type FundQuoteSource = "manual" | "yahoo";

export type FundRecord = {
  id: string;
  user_key: string;
  date: string;
  name: string;
  quote_source?: FundQuoteSource | null;
  quote_symbol?: string | null;
  price: number;
  change_amount: number;
  nav_million: number;
  units: number;
  last_price_updated_at?: string | null;
  created_at?: string;
};

export type TickerHolding = {
  id: string;
  user_key: string;
  ticker: string;
  price: number;
  shares: number;
  created_at?: string;
};

export type FxTrade = {
  id: string;
  user_key: string;
  date: string;
  result: number;
  memo: string | null;
  created_at?: string;
};

export type FxRiskInput = {
  id: string;
  user_key: string;
  margin: number;
  units: number;
  contract_rate: number;
  current_rate: number;
  leverage: number;
  swap_per_unit: number;
  holding_days: number;
  extra_margin: number;
  created_at?: string;
};

export type FinanceSettings = {
  annualReturnRates: {
    fund: number;
    active: number;
    usd: number;
  };
};

export type FinanceState = {
  monthly: MonthlyRecord[];
  investments: InvestmentRecord[];
  funds: FundRecord[];
  tickers: TickerHolding[];
  fxTrades: FxTrade[];
  fxRisk: FxRiskInput;
  settings: FinanceSettings;
};
