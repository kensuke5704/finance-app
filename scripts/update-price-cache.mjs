import { readFile, writeFile } from "node:fs/promises";

const targets = JSON.parse(await readFile("public/price-targets.json", "utf8"));

const FUND_ALIASES = {
  "EMAXISNEO宇宙開発": ["03311187", "03311187.T"],
  "ROBOPROファンド": ["0331418A", "0331418A.T"],
  "MEGA10": ["03313188", "03313188.T"],
};

const TICKER_ALIASES = {
  USDJPY: ["USDJPY=X", "USDJPY"],
};

function normalize(value) {
  return String(value ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

function unique(values) {
  return Array.from(new Set(values.map(normalize).filter(Boolean)));
}

function symbolsForFund(key) {
  const normalized = normalize(key);
  const aliases = FUND_ALIASES[normalized] ?? [];
  const direct = normalized.includes(".") ? [normalized] : [normalized, `${normalized}.T`];
  return unique([...aliases, ...direct]);
}

function symbolsForTicker(key) {
  const normalized = normalize(key);
  const aliases = TICKER_ALIASES[normalized] ?? [];
  const direct = normalized.includes(".") ? [normalized] : [normalized, `${normalized}.US`, `${normalized}.T`];
  return unique([...aliases, ...direct]);
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
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json,text/html,text/plain,*/*",
        ...(options.headers ?? {}),
      },
    });
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
  if (normalized === "USDJPY=X") return null;
  const base = normalized.includes(".") ? normalized.toLowerCase() : `${normalized.toLowerCase()}.us`;
  try {
    const response = await fetchWithTimeout(
      `https://stooq.com/q/l/?s=${encodeURIComponent(base)}&f=sd2t2ohlcv&h&e=csv`,
      { headers: { Accept: "text/csv,text/plain,*/*" } },
    );
    if (!response.ok) return null;
    return parseStooqCsvPrice(await response.text());
  } catch {
    return null;
  }
}

function parseYahooJapanFundPrice(html) {
  const decoded = html
    .replace(/&quot;/g, '"')
    .replace(/&#x2F;/g, "/")
    .replace(/&amp;/g, "&");

  const patterns = [
    /"regularMarketPrice"\s*:\s*\{\s*"raw"\s*:\s*([0-9.]+)/,
    /"regularMarketPrice"\s*:\s*([0-9.]+)/,
    /"price"\s*:\s*\{\s*"raw"\s*:\s*([0-9.]+)/,
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    const value = match?.[1] ? Number(match[1]) : null;
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }

  const text = decoded.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const match = text.match(/基準価額[^0-9]*([0-9,]{3,})/);
  const value = match?.[1] ? Number(match[1].replace(/,/g, "")) : null;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchYahooJapanFundPrice(symbols) {
  for (const symbol of symbols) {
    try {
      const response = await fetchWithTimeout(
        `https://finance.yahoo.co.jp/quote/${encodeURIComponent(symbol)}`,
        { headers: { Accept: "text/html,*/*" } },
      );
      if (!response.ok) continue;
      const price = parseYahooJapanFundPrice(await response.text());
      if (typeof price === "number" && Number.isFinite(price)) {
        return { price, symbol, source: "yahoo-japan" };
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

async function fetchFundPrice(key) {
  const symbols = symbolsForFund(key);
  for (const symbol of symbols) {
    const price = await fetchYahooChart(symbol);
    if (typeof price === "number" && Number.isFinite(price)) {
      return { price, symbol, source: "yahoo-chart" };
    }
  }
  return fetchYahooJapanFundPrice(symbols);
}

async function fetchTickerPrice(key) {
  const symbols = symbolsForTicker(key);
  for (const symbol of symbols) {
    const price = await fetchYahooChart(symbol);
    if (typeof price === "number" && Number.isFinite(price)) {
      return { price, symbol, source: "yahoo-chart" };
    }
  }
  for (const symbol of symbols) {
    const stooq = await fetchStooqPrice(symbol);
    if (typeof stooq === "number" && Number.isFinite(stooq)) {
      return { price: stooq, symbol, source: "stooq" };
    }
  }
  return null;
}

const updatedAt = new Date().toISOString();
const cache = {
  updatedAt,
  funds: {},
  tickers: {},
};

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
