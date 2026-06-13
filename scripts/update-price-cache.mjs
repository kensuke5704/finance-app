import { readFile, writeFile } from "node:fs/promises";

const targets = JSON.parse(await readFile("public/price-targets.json", "utf8"));

const FUND_ALIASES = {
  "EMAXISNEO宇宙開発": ["03313188"],
};

const TICKER_ALIASES = {
  USDJPY: ["USDJPY=X"],
};

function normalize(value) {
  return String(value ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

function unique(values) {
  return Array.from(new Set(values.map(normalize).filter(Boolean)));
}

function isFxSymbol(symbol) {
  return symbol === "USDJPY" || symbol === "USDJPY=X";
}

function symbolsForFund(key) {
  const normalized = normalize(key);
  const aliases = FUND_ALIASES[normalized] ?? [];
  const direct = /^[0-9A-Z]{6,10}(\.T)?$/.test(normalized)
    ? [normalized.replace(/\.T$/, "")]
    : [];
  return unique([...aliases, ...direct]);
}

function symbolsForTicker(key) {
  const normalized = normalize(key);
  const aliases = TICKER_ALIASES[normalized] ?? [];
  if (aliases.length) return unique(aliases);
  return unique([normalized]);
}

function extractYahooChartPrice(data) {
  const result = data?.chart?.result?.[0];
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

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchYahooChart(symbol) {
  try {
    const response = await fetchWithTimeout(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`,
    );
    if (!response.ok) return null;
    return extractYahooChartPrice(await response.json());
  } catch {
    return null;
  }
}

function parseStooqCsvPrice(csv) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const columns = lines[1].split(",");
  const close = Number(columns[6]);
  return Number.isFinite(close) ? close : null;
}

async function fetchStooqPrice(symbol) {
  const normalized = normalize(symbol);
  if (!normalized || isFxSymbol(normalized)) return null;
  const base = normalized.includes(".") ? normalized.toLowerCase() : `${normalized.toLowerCase()}.us`;
  try {
    const response = await fetchWithTimeout(
      `https://stooq.com/q/l/?s=${encodeURIComponent(base)}&f=sd2t2ohlcv&h&e=csv`,
    );
    if (!response.ok) return null;
    return parseStooqCsvPrice(await response.text());
  } catch {
    return null;
  }
}

function parseYahooJapanFundPrice(html) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const beforeChange = text.split("前日比")[0] ?? "";
  const matches = beforeChange.match(/[0-9][0-9,]{2,}/g) ?? [];
  const value = matches.length ? Number(matches[matches.length - 1].replace(/,/g, "")) : null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchYahooJapanFundPrice(symbols) {
  for (const symbol of symbols) {
    try {
      const response = await fetchWithTimeout(`https://finance.yahoo.co.jp/quote/${encodeURIComponent(symbol)}`);
      if (!response.ok) continue;
      const price = parseYahooJapanFundPrice(await response.text());
      if (typeof price === "number" && Number.isFinite(price)) {
        return { price, symbol, source: "yahoo-japan" };
      }
    } catch {}
  }
  return null;
}

async function fetchFundPrice(key) {
  const symbols = symbolsForFund(key);
  if (symbols.length === 0) return null;
  const yahooJapan = await fetchYahooJapanFundPrice(symbols);
  if (yahooJapan) return yahooJapan;
  return null;
}

async function fetchTickerPrice(key) {
  const symbols = symbolsForTicker(key);

  for (const symbol of symbols) {
    if (isFxSymbol(symbol)) continue;
    const stooq = await fetchStooqPrice(symbol);
    if (typeof stooq === "number" && Number.isFinite(stooq)) {
      return { price: stooq, symbol, source: "stooq" };
    }
  }

  for (const symbol of symbols) {
    const price = await fetchYahooChart(symbol);
    if (typeof price === "number" && Number.isFinite(price)) {
      return { price, symbol, source: "yahoo-chart" };
    }
  }
  return null;
}

const updatedAt = new Date().toISOString();
const cache = { updatedAt, funds: {}, tickers: {} };

for (const key of unique(targets.funds ?? [])) {
  const result = await fetchFundPrice(key);
  cache.funds[key] = result ? { ...result, updatedAt } : { updatedAt, error: "not-found" };
  if (result?.symbol && result.symbol !== key) cache.funds[result.symbol] = cache.funds[key];
  for (const alias of FUND_ALIASES[key] ?? []) cache.funds[alias] = cache.funds[key];
}

for (const key of unique(targets.tickers ?? [])) {
  const result = await fetchTickerPrice(key);
  cache.tickers[key] = result ? { ...result, updatedAt } : { updatedAt, error: "not-found" };
  if (result?.symbol && result.symbol !== key) cache.tickers[result.symbol] = cache.tickers[key];
  for (const alias of TICKER_ALIASES[key] ?? []) cache.tickers[alias] = cache.tickers[key];
}

await writeFile("public/price-cache.json", `${JSON.stringify(cache, null, 2)}\n`);
console.log(`Updated price cache at ${updatedAt}`);
