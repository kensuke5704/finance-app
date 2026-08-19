import { HttpsError, onCall } from "firebase-functions/v2/https";

const ALLOWED_EMAILS = new Set([
  "kensuke5704@gmail.com",
  "momoha5704@gmail.com",
]);

type FundQuote = {
  code: string;
  price: number;
  asOfDate: string;
  updatedAt: string;
  source: string;
};

type FundSource = {
  url: string;
  source: string;
  parse: (html: string) => Omit<FundQuote, "code" | "updatedAt" | "source"> | null;
};

function normalizeCode(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

function dateString(year: string, month: string, day: string) {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseMufgFundPage(html: string) {
  const price = html.match(/id="kijyunKagaku">\s*([0-9,]+)\s*</)?.[1];
  const date = html.match(/id="kijyunYmd">\s*(20\d{2})年(\d{1,2})月(\d{1,2})日\s*</);
  if (!price || !date) return null;
  const parsedPrice = Number(price.replace(/,/g, ""));
  if (!Number.isFinite(parsedPrice)) return null;
  return { price: parsedPrice, asOfDate: dateString(date[1], date[2], date[3]) };
}

function parseSbiOkasanFundPage(html: string) {
  const date = html.match(/基準日：\s*(20\d{2})年(\d{1,2})月(\d{1,2})日/);
  const price = html.match(/基準価額（円）<\/th>[\s\S]*?<td>\s*<span[^>]*>\s*([0-9,]+)\s*<\/span>/)?.[1];
  if (!price || !date) return null;
  const parsedPrice = Number(price.replace(/,/g, ""));
  if (!Number.isFinite(parsedPrice)) return null;
  return { price: parsedPrice, asOfDate: dateString(date[1], date[2], date[3]) };
}

function parseSbiHistory(html: string) {
  const text = html
    .replace(/&nbsp;/g, " ")
    .replace(/&#x2F;/g, "/")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");
  const match = text.match(/(20\d{2})\/(\d{1,2})\/(\d{1,2})\s+([0-9][0-9,]*)円/);
  if (!match) return null;
  const price = Number(match[4].replace(/,/g, ""));
  if (!Number.isFinite(price)) return null;
  return { price, asOfDate: dateString(match[1], match[2], match[3]) };
}

const OFFICIAL_SOURCES: Record<string, FundSource> = {
  "03313188": {
    url: "https://fs.bk.mufg.jp/webasp/mufg/fund/detail/m00353320.html",
    source: "mufg-public",
    parse: parseMufgFundPage,
  },
  "0931123C": {
    url: "https://www.sbiokasan-am.co.jp/fund/553175/",
    source: "sbiokasan-public",
    parse: parseSbiOkasanFundPage,
  },
};

async function requestHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; FinanceFundQuote/1.0)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;
  return response.text();
}

async function fetchLatestQuote(code: string): Promise<FundQuote | null> {
  const official = OFFICIAL_SOURCES[code];
  if (official) {
    const html = await requestHtml(official.url);
    const parsed = html ? official.parse(html) : null;
    if (parsed) {
      return { code, ...parsed, updatedAt: new Date().toISOString(), source: official.source };
    }
  }

  const historyUrl = `https://site0.sbisec.co.jp/marble/fund/history/standardprice.do?fund_sec_code=${encodeURIComponent(code)}`;
  const html = await requestHtml(historyUrl);
  const parsed = html ? parseSbiHistory(html) : null;
  return parsed
    ? { code, ...parsed, updatedAt: new Date().toISOString(), source: "sbi-public-history" }
    : null;
}

export const fetchFundQuote = onCall(
  {
    region: "asia-northeast1",
    timeoutSeconds: 20,
    maxInstances: 2,
    cors: ["https://kensuke5704.github.io"],
  },
  async (request) => {
    const email = request.auth?.token.email;
    if (!email || !ALLOWED_EMAILS.has(email)) {
      throw new HttpsError("permission-denied", "この機能を利用する権限がありません。");
    }

    const code = normalizeCode(request.data?.code);
    if (!/^[0-9A-Z]{8}$/.test(code)) {
      throw new HttpsError("invalid-argument", "銘柄コードを8文字で指定してください。");
    }

    try {
      const quote = await fetchLatestQuote(code);
      if (!quote) throw new HttpsError("not-found", "基準価額を取得できませんでした。");
      return quote;
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("unavailable", "基準価額の取得先に接続できませんでした。");
    }
  },
);
