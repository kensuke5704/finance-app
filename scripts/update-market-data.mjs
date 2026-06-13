import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const momentumDataPath = path.join(root, "lib", "momentumData.ts");
const priceCachePath = path.join(root, "public", "price-cache.json");
const startDate = "2021-01-01";

const fundFallbacks = {
  "EMAXISNEO宇宙開発": { price: 63325, symbol: "03313188", source: "fallback-yahoo-japan" },
  "03313188": { price: 63325, symbol: "03313188", source: "fallback-yahoo-japan" },
  "ROBOPROファンド": { price: 15337, symbol: "0931123C", source: "fallback-yahoo-japan" },
  "0931123C": { price: 15337, symbol: "0931123C", source: "fallback-yahoo-japan" },
  "MEGA10": { price: 10505, symbol: "2931225B", source: "fallback-yahoo-japan" },
  "2931225B": { price: 10505, symbol: "2931225B", source: "fallback-yahoo-japan" },
};

function toEpochSeconds(dateString) {
  return Math.floor(new Date(`${dateString}T00:00:00Z`).getTime() / 1000);
}

function monthKeyFromUnix(timestamp) {
  const date = new Date(timestamp * 1000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthEndDate(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 0));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function formatPrice(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return Number(value.toFixed(2)).toString();
}

function extractTickerSeeds(source) {
  const match = source.match(/export const MOMENTUM_TICKERS: MomentumTickerSeed\[\] = (\[[\s\S]*?\]);/);
  if (!match) throw new Error("MOMENTUM_TICKERS block was not found");
  return JSON.parse(match[1]);
}

async function fetchYahooDaily(symbol) {
  const period1 = toEpochSeconds(startDate);
  const period2 = Math.floor(Date.now() / 1000) + 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=history`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 finance-app market-data-updater",
      accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(`${symbol}: Yahoo response ${response.status}`);

  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  if (!timestamps.length || !closes.length) throw new Error(`${symbol}: no price data`);

  const monthly = new Map();
  let latest = null;
  timestamps.forEach((timestamp, index) => {
    const close = closes[index];
    if (typeof close !== "number" || !Number.isFinite(close) || close <= 0) return;
    monthly.set(monthKeyFromUnix(timestamp), close);
    latest = close;
  });

  return { symbol, monthly, latest };
}

async function mapWithConcurrency(items, limit, task) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      try {
        results[currentIndex] = await task(items[currentIndex]);
      } catch (error) {
        console.warn(error instanceof Error ? error.message : String(error));
        results[currentIndex] = null;
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

async function main() {
  const source = await fs.readFile(momentumDataPath, "utf8");
  const tickers = extractTickerSeeds(source);
  const symbols = tickers.map((ticker) => ticker.symbol).filter(Boolean);
  const updatedAt = new Date().toISOString();

  const fetched = await mapWithConcurrency(symbols, 6, fetchYahooDaily);
  const dataBySymbol = new Map();
  fetched.forEach((item) => {
    if (item) dataBySymbol.set(item.symbol, item);
  });

  const allMonths = new Set();
  dataBySymbol.forEach((item) => item.monthly.forEach((_, month) => allMonths.add(month)));
  const sortedMonths = Array.from(allMonths).sort();

  const csvLines = [
    ["date", ...symbols].join(","),
    ...sortedMonths.map((month) => {
      const values = symbols.map((symbol) => formatPrice(dataBySymbol.get(symbol)?.monthly.get(month)));
      return [monthEndDate(month), ...values].join(",");
    }),
  ];

  const nextSource = source.replace(
    /const MOMENTUM_MONTHLY_CSV = `[\s\S]*?`;\n\nexport const MOMENTUM_MONTHLY_ROWS:/,
    `const MOMENTUM_MONTHLY_CSV = \`${csvLines.join("\n")}\`;\n\nexport const MOMENTUM_MONTHLY_ROWS:`,
  );

  if (nextSource === source) throw new Error("MOMENTUM_MONTHLY_CSV block was not replaced");
  await fs.writeFile(momentumDataPath, nextSource);

  let currentPriceCache = {};
  try {
    currentPriceCache = JSON.parse(await fs.readFile(priceCachePath, "utf8"));
  } catch {
    currentPriceCache = {};
  }

  const tickersCache = { ...(currentPriceCache.tickers ?? {}) };
  dataBySymbol.forEach((item, symbol) => {
    if (typeof item.latest !== "number") return;
    tickersCache[symbol] = {
      price: Number(item.latest.toFixed(4)),
      symbol,
      source: "yahoo-chart",
      updatedAt,
    };
  });

  const nextPriceCache = {
    updatedAt,
    funds: currentPriceCache.funds ?? Object.fromEntries(
      Object.entries(fundFallbacks).map(([key, item]) => [key, { ...item, updatedAt }]),
    ),
    tickers: tickersCache,
  };

  await fs.writeFile(priceCachePath, `${JSON.stringify(nextPriceCache, null, 2)}\n`);
  console.log(`Updated ${dataBySymbol.size} symbols through ${updatedAt}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
