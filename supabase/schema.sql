drop table if exists finance_fx_risk_inputs;
drop table if exists finance_fx_trades;
drop table if exists finance_ticker_holdings;
drop table if exists finance_fund_records;
drop table if exists finance_investment_records;
drop table if exists finance_monthly_records;

create table finance_monthly_records (
  id text primary key,
  user_key text not null default 'personal',
  month text not null,
  age integer not null default 0,
  cash_prediction numeric not null default 0,
  cash_actual numeric not null default 0,
  income_budget numeric not null default 0,
  income_actual numeric not null default 0,
  outgo_budget numeric not null default 0,
  outgo_cash numeric not null default 0,
  outgo_card numeric not null default 0,
  outgo_other numeric not null default 0,
  invest_budget numeric not null default 0,
  invest_actual numeric not null default 0,
  usd_capital numeric not null default 0,
  usd_actual numeric not null default 0,
  note text,
  created_at timestamp with time zone default now()
);

create table finance_investment_records (
  id text primary key,
  user_key text not null default 'personal',
  month text not null,
  account text not null,
  deposit numeric not null default 0,
  withdrawal numeric not null default 0,
  capital numeric not null default 0,
  predicted_balance numeric not null default 0,
  actual_balance numeric not null default 0,
  monthly_return_rate numeric not null default 0,
  note text,
  created_at timestamp with time zone default now()
);

create table finance_fund_records (
  id text primary key,
  user_key text not null default 'personal',
  date date not null,
  name text not null,
  price numeric not null default 0,
  change_amount numeric not null default 0,
  nav_million numeric not null default 0,
  units numeric not null default 0,
  created_at timestamp with time zone default now()
);

create table finance_ticker_holdings (
  id text primary key,
  user_key text not null default 'personal',
  ticker text not null,
  price numeric not null default 0,
  shares numeric not null default 0,
  created_at timestamp with time zone default now()
);

create table finance_fx_trades (
  id text primary key,
  user_key text not null default 'personal',
  date date not null,
  result numeric not null default 0,
  memo text,
  created_at timestamp with time zone default now()
);

create table finance_fx_risk_inputs (
  id text primary key,
  user_key text not null default 'personal',
  margin numeric not null default 0,
  units numeric not null default 0,
  contract_rate numeric not null default 0,
  current_rate numeric not null default 0,
  leverage numeric not null default 1,
  swap_per_unit numeric not null default 0,
  holding_days numeric not null default 0,
  extra_margin numeric not null default 0,
  created_at timestamp with time zone default now()
);

alter table finance_monthly_records enable row level security;
alter table finance_investment_records enable row level security;
alter table finance_fund_records enable row level security;
alter table finance_ticker_holdings enable row level security;
alter table finance_fx_trades enable row level security;
alter table finance_fx_risk_inputs enable row level security;

create policy "Allow all finance monthly records"
on finance_monthly_records for all using (true) with check (true);

create policy "Allow all finance investment records"
on finance_investment_records for all using (true) with check (true);

create policy "Allow all finance fund records"
on finance_fund_records for all using (true) with check (true);

create policy "Allow all finance ticker holdings"
on finance_ticker_holdings for all using (true) with check (true);

create policy "Allow all finance fx trades"
on finance_fx_trades for all using (true) with check (true);

create policy "Allow all finance fx risk inputs"
on finance_fx_risk_inputs for all using (true) with check (true);
