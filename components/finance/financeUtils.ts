import type { FundRecord, InvestmentRecord, MonthlyRecord, TickerHolding } from "../../types/finance";

const yen = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
const usdFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const usdPriceFormatter = new Intl.NumberFormat("ja-JP", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const fundCodeByName: Record<string, string> = {
  "EMAXISNEO宇宙開発": "03313188",
  "ROBOPROファンド": "0931123C",
  "MEGA10": "2931225B",
};
export const pct = new Intl.NumberFormat("ja-JP", {
  style: "percent",
  maximumFractionDigits: 2,
});

type PriceCacheItem = {
  price?: number;
  updatedAt?: string;
  source?: string;
  symbol?: string;
};

type PriceCache = {
  updatedAt?: string;
  funds?: Record<string, PriceCacheItem>;
  tickers?: Record<string, PriceCacheItem>;
};

export function n(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function money(value: number) {
  return `${yen.format(Math.round(value))}円`;
}

export function usdMoney(value: number) {
  return usdFormatter.format(Number.isFinite(value) ? value : 0);
}

export function usdPrice(value: number) {
  return usdPriceFormatter.format(Number.isFinite(value) ? value : 0);
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
  return n(row.price) * n(row.shares);
}

export function formatCount(value: number) {
  if (!value) return "0";
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 4 }).format(value);
}

function normalizeQuoteSymbol(value: string) {
  return value.trim().replace(/\s+/g, "");
}

function normalizePriceKey(value: string) {
  return normalizeQuoteSymbol(value).toUpperCase();
}

export function quoteSymbolForFund(row: FundRecord) {
  const normalizedName = normalizePriceKey(row.name || "");
  const mappedCode = fundCodeByName[normalizedName];
  if (mappedCode) return mappedCode;

  const directCode = normalizeQuoteSymbol(row.quote_symbol || "");
  if (directCode) return directCode;

  return normalizeQuoteSymbol(row.name || "");
}

export function quoteSymbolForTicker(row: TickerHolding) {
  return normalizeQuoteSymbol(row.ticker || "");
}

function publicAssetPath(path: string) {
  return `${basePath}${path.startsWith("/") ? path : `/${path}`}`;
}

async function loadPriceCache() {
  try {
    const response = await fetch(`${publicAssetPath("/price-cache.json")}?ts=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as PriceCache;
  } catch {
    return null;
  }
}

function priceFromCacheItem(item?: PriceCacheItem) {
  const price = item?.price;
  return typeof price === "number" && Number.isFinite(price) ? price : null;
}

export async function fetchLatestFundPrice(code: string) {
  const cache = await loadPriceCache();
  const normalized = normalizePriceKey(code);
  if (!normalized) return null;

  const mappedCode = fundCodeByName[normalized];
  const baseCandidates = normalized.includes(".")
    ? [normalized, normalized.replace(/\.T$/, "")]
    : [normalized, `${normalized}.T`];
  const candidates = mappedCode ? [mappedCode, ...baseCandidates] : baseCandidates;

  for (const candidate of candidates) {
    const price = priceFromCacheItem(cache?.funds?.[candidate]);
    if (typeof price === "number") return price;
  }

  return null;
}

export async function fetchLatestMarketPrice(symbol: string) {
  const cache = await loadPriceCache();
  const normalized = normalizePriceKey(symbol);
  if (!normalized) return null;

  const candidates = normalized.includes(".")
    ? [normalized, normalized.replace(/\.US$/, "").replace(/\.T$/, "")]
    : [normalized, `${normalized}.US`, `${normalized}.T`];

  for (const candidate of candidates) {
    const price = priceFromCacheItem(cache?.tickers?.[candidate]);
    if (typeof price === "number") return price;
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
