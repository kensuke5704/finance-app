import { fetchGooglePortfolio } from "../../../lib/googlePortfolio";
import { newInvestmentRecord } from "../../../lib/financeStore";
import type { FinanceState, InvestmentRecord, TickerHolding } from "../../../types/finance";
import {
  fetchLatestFundPrice,
  fundEvaluation,
  quoteSymbolForFund,
  uid,
} from "../../../components/finance/financeUtils";
import {
  SHORT_K_ASSET_ACCOUNTS,
  buildShortKAssetEvaluationNote,
  currentMonthString,
  previousMonth,
  shortKAccountDepositForMonth,
  shortKAccountPredictedValue,
  shortKAccountPrincipal,
  shortKAssetRowMatches,
} from "../../../components/finance/FinanceShared";
import type { ShortKAssetAccountKey } from "../../../components/finance/FinanceShared";

function normalizeFundName(name: string) {
  return name.normalize("NFKC").replace(/\s+/g, "").toUpperCase();
}

function syncPortfolioHoldings(
  state: FinanceState,
  rows: Awaited<ReturnType<typeof fetchGooglePortfolio>>["rows"],
): TickerHolding[] {
  const holdings = new Map(state.tickers.map((row) => [row.ticker, row]));
  const stocks = rows.map((row) => ({
    ...(holdings.get(row.ticker) ?? {
      id: uid(),
      user_key: "personal",
      ticker: row.ticker,
      shares: 0,
    }),
    price: row.daily,
  }));
  const cash = holdings.get("CASH") ?? {
    id: uid(),
    user_key: "personal",
    ticker: "CASH",
    price: 0,
    shares: 1,
  };
  return [...stocks, cash];
}

function setAccountValue(
  state: FinanceState,
  investments: InvestmentRecord[],
  month: string,
  key: ShortKAssetAccountKey,
  value: number,
) {
  const config = SHORT_K_ASSET_ACCOUNTS[key];
  const existing = investments.find(
    (row) => row.month === month && shortKAssetRowMatches(row, config.account),
  );
  const patch = {
    capital: shortKAccountPrincipal(
      key,
      month,
      state.monthly,
      investments,
      state.settings.annualReturnRates,
    ),
    actual_balance: Math.round(value),
    predicted_balance: shortKAccountPredictedValue(
      key,
      month,
      state.monthly,
      investments,
      state.settings.annualReturnRates,
    ),
    note: buildShortKAssetEvaluationNote(existing),
  };

  if (existing) {
    return investments.map((row) =>
      row.id === existing.id ? { ...row, ...patch } : row,
    );
  }

  return [
    ...investments,
    {
      ...newInvestmentRecord(),
      month,
      account: config.account,
      ...patch,
    },
  ];
}

export async function refreshInvestmentState(state: FinanceState): Promise<FinanceState> {
  const month = currentMonthString();
  const portfolio = await fetchGooglePortfolio();
  const funds = await Promise.all(
    state.funds.map(async (fund) => {
      const price = await fetchLatestFundPrice(quoteSymbolForFund(fund));
      return typeof price === "number"
        ? { ...fund, price, last_price_updated_at: new Date().toISOString() }
        : fund;
    }),
  );
  const tickers = syncPortfolioHoldings(state, portfolio.rows);

  const fundAccountValue = funds
    .filter((fund) => {
      const name = normalizeFundName(fund.name);
      return name.includes("ROBOPRO") || name.includes("MEGA10");
    })
    .reduce((sum, fund) => sum + fundEvaluation(fund), 0);
  const emaxisValue = funds
    .filter((fund) => normalizeFundName(fund.name).includes("EMAXISNEO"))
    .reduce((sum, fund) => sum + fundEvaluation(fund), 0);
  const activeUsd = tickers.reduce(
    (sum, row) => sum + (row.ticker === "CASH" ? row.price : row.price * row.shares),
    0,
  );
  const activeAccountValue = emaxisValue + activeUsd * portfolio.usdJpy;

  const previousFx = state.investments.find(
    (row) =>
      row.month === previousMonth(month) &&
      shortKAssetRowMatches(row, SHORT_K_ASSET_ACCOUNTS.usd.account),
  );
  const previousFxValue = previousFx?.actual_balance || previousFx?.predicted_balance || 0;
  const currentFxDeposit = shortKAccountDepositForMonth("usd", month, state.monthly);
  const currentFxProfit = state.fxTrades
    .filter((trade) => trade.date.startsWith(month))
    .reduce((sum, trade) => sum + trade.result, 0);

  const baseState = { ...state, funds, tickers };
  let investments = [...state.investments];
  investments = setAccountValue(baseState, investments, month, "fund", fundAccountValue);
  investments = setAccountValue(baseState, investments, month, "active", activeAccountValue);
  investments = setAccountValue(
    baseState,
    investments,
    month,
    "usd",
    previousFxValue + currentFxDeposit + currentFxProfit,
  );

  return { ...baseState, investments };
}
