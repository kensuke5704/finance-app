import type { FundRecord, InvestmentRecord, MonthlyRecord, TickerHolding } from "../../types/finance";

const yen = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
export const pct = new Intl.NumberFormat("ja-JP", {
  style: "percent",
  maximumFractionDigits: 2,
});

export function n(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function money(value: number) {
  return `${yen.format(Math.round(value))}円`;
}

export function signedMoney(value: number) {
  const rounded = Math.round(value);
  const sign = rounded >= 0 ? "+" : "";
  return `${sign}${money(rounded)}`;
}

export function signedRate(value: number, base: number) {
  if (!base) return "—";
  const rate = value / base;
  const sign = rate >= 0 ? "+" : "";
  return `${sign}${pct.format(rate)}`;
}

export function formatMoneyInput(value: number) {
  if (!value) return "";
  return yen.format(Math.round(value));
}

export function parseMoneyInput(value: string) {
  const parsed = Number(value.replace(/[^0-9-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parsePlainNumberInput(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function todayString() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function fundEvaluation(row: FundRecord) {
  return (n(row.price) * n(row.units)) / 10000;
}

export function tickerEvaluation(row: TickerHolding) {
  return n(row.price) * Math.max(1, n(row.shares));
}

export function formatCount(value: number) {
  if (!value) return "0";
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 4 }).format(value);
}

function normalizeQuoteSymbol(value: string) {
  return value.trim().replace(/\s+/g, "");
}

export function quoteSymbolForFund(row: FundRecord) {
  return normalizeQuoteSymbol(row.quote_symbol || row.name || "");
}

export function quoteSymbolForTicker(row: TickerHolding) {
  return normalizeQuoteSymbol(row.ticker || "");
}


export async function fetchLatestFundPrice(code: string) {
  const normalized = normalizeQuoteSymbol(code);
  if (!normalized) return null;

  try {
    const response = await fetch(`/api/fund-quote?code=${encodeURIComponent(normalized)}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const json = await response.json();
    const price = Number(json?.price);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

export async function fetchLatestMarketPrice(symbol: string) {
  const normalized = normalizeQuoteSymbol(symbol);
  if (!normalized) return null;

  const upper = normalized.toUpperCase();
  const candidates = Array.from(new Set([
    normalized,
    upper,
    `${normalized}.T`,
    `${upper}.T`,
  ]));
  for (const candidate of candidates) {
    try {
      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(candidate)}?range=5d&interval=1d`,
      );
      if (!response.ok) continue;
      const json = await response.json();
      const result = json?.chart?.result?.[0];
      const quote = result?.indicators?.quote?.[0];
      const closes = Array.isArray(quote?.close) ? quote.close : [];
      const latest = [...closes].reverse().find((item) => Number.isFinite(Number(item)));
      if (Number.isFinite(Number(latest)) && Number(latest) > 0) {
        return Number(latest);
      }
    } catch {
      // Ignore network failures and keep the current price.
    }
  }
  return null;
}

export function actualCash(row?: MonthlyRecord) {
  if (!row) return 0;
  return row.cash_actual || row.cash_prediction || 0;
}

export function actualIncome(row?: MonthlyRecord) {
  if (!row) return 0;
  return row.income_actual || row.income_budget || 0;
}

export function actualOutgo(row?: MonthlyRecord) {
  if (!row) return 0;
  const outgo = row.outgo_cash + row.outgo_card + row.outgo_other;
  return outgo || row.outgo_budget || 0;
}

export function actualInvest(row?: MonthlyRecord) {
  if (!row) return 0;
  return row.invest_actual || row.invest_budget || 0;
}

export function netAssets(row?: MonthlyRecord) {
  if (!row) return 0;
  return (
    actualCash(row) +
    actualInvest(row) +
    (row.usd_actual || row.usd_capital || 0)
  );
}

export function investmentValue(row: InvestmentRecord) {
  return row.actual_balance || row.predicted_balance || row.capital || 0;
}

export function totalInvestments(rows: InvestmentRecord[]) {
  return rows.reduce((sum, row) => sum + investmentValue(row), 0);
}
