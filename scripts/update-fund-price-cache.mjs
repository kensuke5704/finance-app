import { readFile, writeFile } from "node:fs/promises";

const targets = JSON.parse(await readFile("public/price-targets.json", "utf8"));

const OFFICIAL_FUND_PAGES = {
  "03313188": "https://fs.bk.mufg.jp/webasp/mufg/fund/detail/m00353320.html",
};

function normalizeCode(value) {
  return String(value ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

function uniqueCodes(values) {
  return [...new Set((values ?? []).map(normalizeCode).filter(Boolean))];
}

function parseHistory(html) {
  const text = html
    .replace(/&nbsp;/g, " ")
    .replace(/&#x2F;/g, "/")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");
  const match = text.match(/(20\d{2})\/(\d{1,2})\/(\d{1,2})\s+([0-9][0-9,]*)円/);
  if (!match) return null;

  const price = Number(match[4].replace(/,/g, ""));
  if (!Number.isFinite(price)) return null;
  return {
    price,
    asOfDate: `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`,
  };
}

function parseOfficialFundPage(html) {
  const price = html.match(/id="kijyunKagaku">\s*([0-9,]+)\s*</)?.[1];
  const date = html.match(/id="kijyunYmd">\s*(20\d{2})年(\d{1,2})月(\d{1,2})日\s*</);
  if (!price || !date) return null;
  const parsedPrice = Number(price.replace(/,/g, ""));
  if (!Number.isFinite(parsedPrice)) return null;
  return {
    price: parsedPrice,
    asOfDate: `${date[1]}-${date[2].padStart(2, "0")}-${date[3].padStart(2, "0")}`,
  };
}

async function fetchFundPrice(code) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(
      `https://site0.sbisec.co.jp/marble/fund/history/standardprice.do?fund_sec_code=${encodeURIComponent(code)}`,
      {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; FinancePriceCache/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
      },
    );
    if (!response.ok) return null;
    return parseHistory(await response.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchOfficialFundPrice(code) {
  const url = OFFICIAL_FUND_PAGES[code];
  if (!url) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FinancePriceCache/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) return null;
    return parseOfficialFundPage(await response.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const updatedAt = new Date().toISOString();
const funds = {};

for (const code of uniqueCodes(targets.funds)) {
  const officialQuote = await fetchOfficialFundPrice(code);
  const quote = officialQuote || await fetchFundPrice(code);
  funds[code] = quote
    ? { ...quote, updatedAt, source: officialQuote ? "mufg-public" : "sbi-public-history" }
    : { updatedAt, error: "not-found" };
}

await writeFile(
  "public/price-cache.json",
  `${JSON.stringify({ updatedAt, funds }, null, 2)}\n`,
);

console.log(`Updated ${Object.keys(funds).length} fund price entries at ${updatedAt}`);
