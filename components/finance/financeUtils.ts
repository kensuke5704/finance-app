import type { FundRecord, InvestmentRecord, MonthlyRecord, TickerHolding } from "../../types/finance";

const yen = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
export const pct = new Intl.NumberFormat("ja-JP", {
  style: "percent",
  maximumFractionDigits: 2,
});

type YahooChartQuote = {
  close?: unknown;
};

type YahooChartResult = {
  meta?: {
    regularMarketPrice?: unknown;
  };
  indicators?: {
    quote?: YahooChartQuote[];
  };
};

type YahooChartResponse = {
  chart?: {
    result?: YahooChartResult[] | null;
  };
};

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

function extractYahooChartPrice(data: unknown) {
  const result = (data as YahooChartResponse).chart?.result?.[0];
  const metaPrice = result?.meta?.regularMarketPrice;
  if (typeof metaPrice === "number" && Number.isFinite(metaPrice)) return metaPrice;

  const closes = result?.indicators?.quote?.[0]?.close;
  if (Array.isArray(closes)) {
    const latest = [...closes]
      .reverse()
      .find((value) => typeof value === "number" && Number.isFinite(value));
    if (typeof latest === "number") return latest;
  }

  return null;
}

function proxyUrls(url: string) {
  return [
    url,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
  ];
}

async function fetchJsonWithFallback(url: string) {
  for (const candidate of proxyUrls(url)) {
    try {
      const response = await fetch(candidate, { cache: "no-store" });
      if (!response.ok) continue;
      return await response.json();
    } catch {
      // try next endpoint
    }
  }
  return null;
}

async function fetchTextWithFallback(url: string) {
  for (const candidate of proxyUrls(url)) {
    try {
      const response = await fetch(candidate, { cache: "no-store" });
      if (!response.ok) continue;
      return await response.text();
    } catch {
      // try next endpoint
    }
  }
  return "";
}

async function fetchYahooChart(symbol: string) {
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
  const data = await fetchJsonWithFallback(yahooUrl);
  return extractYahooChartPrice(data);
}

function parseStooqCsvPrice(csv: string) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const columns = lines[1].split(",");
  const close = Number(columns[6]);
  return Number.isFinite(close) ? close : null;
}

async function fetchStooqPrice(symbol: string) {
  const normalized = normalizeQuoteSymbol(symbol).toLowerCase();
  if (!normalized) return null;
  const base = normalized.includes(".") ? normalized : `${normalized}.us`;
  const stooqUrl = `https://stooq.com/q/l/?s=${encodeURIComponent(base)}&f=sd2t2ohlcv&h&e=csv`;
  const csv = await fetchTextWithFallback(stooqUrl);
  return parseStooqCsvPrice(csv);
}

function parseYahooJapanFundPrice(html: string) {
  const decoded = html
    .replace(/&quot;/g, '"')
    .replace(/&#x2F;/g, "/")
    .replace(/&amp;/g, "&");

  const jsonLikeMatches = [
    /"regularMarketPrice"\s*:\s*\{\s*"raw"\s*:\s*([0-9.]+)/,
    /"regularMarketPrice"\s*:\s*([0-9.]+)/,
    /"price"\s*:\s*\{\s*"raw"\s*:\s*([0-9.]+)/,
  ];

  for (const pattern of jsonLikeMatches) {
    const match = decoded.match(pattern);
    const value = match?.[1] ? Number(match[1]) : null;
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }

  const text = decoded.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const basePriceMatch = text.match(/基準価額[^0-9]*([0-9,]{3,})/);
  const value = basePriceMatch?.[1]
    ? Number(basePriceMatch[1].replace(/,/g, ""))
    : null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchYahooJapanFundPrice(code: string) {
  const normalized = normalizeQuoteSymbol(code).toUpperCase();
  if (!normalized) return null;
  const urls = [
    `https://finance.yahoo.co.jp/quote/${encodeURIComponent(normalized)}`,
    `https://finance.yahoo.co.jp/quote/${encodeURIComponent(`${normalized}.T`)}`,
  ];

  for (const url of urls) {
    const html = await fetchTextWithFallback(url);
    const price = parseYahooJapanFundPrice(html);
    if (typeof price === "number" && Number.isFinite(price)) return price;
  }

  return null;
}

export async function fetchLatestFundPrice(code: string) {
  const normalized = normalizeQuoteSymbol(code).toUpperCase();
  if (!normalized) return null;
  const chartCandidates = normalized.includes(".") ? [normalized] : [normalized, `${normalized}.T`];

  for (const candidate of chartCandidates) {
    const price = await fetchYahooChart(candidate);
    if (typeof price === "number" && Number.isFinite(price)) return price;
  }

  return fetchYahooJapanFundPrice(normalized);
}

export async function fetchLatestMarketPrice(symbol: string) {
  const normalized = normalizeQuoteSymbol(symbol).toUpperCase();
  if (!normalized) return null;
  const chartCandidates = normalized.includes(".") ? [normalized] : [normalized, `${normalized}.US`, `${normalized}.T`];

  for (const candidate of chartCandidates) {
    const price = await fetchYahooChart(candidate);
    if (typeof price === "number" && Number.isFinite(price)) return price;
  }

  return fetchStooqPrice(normalized);
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
