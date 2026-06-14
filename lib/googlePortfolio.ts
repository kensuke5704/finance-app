export const PORTFOLIO_SHEET_ID = "15cABJhz4OqKxfxu6qDcne5SoDTb8qm1DbHn5fzwFCUM";
export const PORTFOLIO_SHEET_NAME = "ポートフォリオ";

const CACHE_KEY = "finance.googlePortfolio.v1";

export type GooglePortfolioRow = {
  ticker: string;
  daily: number;
  monthly: number;
  return1m: number;
  return3m: number;
  return6m: number;
  score: number;
  rank: number;
  shares: number | null;
  values: Record<string, string>;
};

export type GooglePortfolioData = {
  rows: GooglePortfolioRow[];
  headers: string[];
  updatedAt: string;
  source: "sheet" | "cache";
};

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function normalizedHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s_./()%％・\-]/g, "");
}

function findColumn(headers: string[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizedHeader);
  return headers.findIndex((header) => normalizedAliases.includes(normalizedHeader(header)));
}

function numeric(value: string, percent = false) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = Number(trimmed.replace(/[$¥￥,\s]/g, "").replace(/%|％/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return percent && /%|％/.test(trimmed) ? parsed / 100 : parsed;
}

function portfolioFromCsv(text: string): GooglePortfolioData {
  const rawRows = parseCsv(text);
  const headerIndex = rawRows.findIndex((row) => {
    const normalized = row.map(normalizedHeader);
    return normalized.includes("ticker") && normalized.includes("daily");
  });
  if (headerIndex < 0) throw new Error("TickerとDailyの見出しが見つかりません");

  const headers = rawRows[headerIndex].map((header) => header.trim());
  const tickerIndex = findColumn(headers, ["Ticker", "ティッカー", "銘柄"]);
  const dailyIndex = findColumn(headers, ["Daily", "現在値", "Current", "Price"]);
  const monthlyIndex = findColumn(headers, ["Monthly", "基準値", "Base"]);
  const oneMonthIndex = findColumn(headers, ["1M", "1か月", "1ヶ月"]);
  const threeMonthIndex = findColumn(headers, ["3M", "3か月", "3ヶ月"]);
  const sixMonthIndex = findColumn(headers, ["6M", "6か月", "6ヶ月"]);
  const scoreIndex = findColumn(headers, ["Score", "スコア"]);
  const rankIndex = findColumn(headers, ["Rank", "順位"]);
  const sharesIndex = findColumn(headers, ["Shares", "保有数", "株数", "Quantity"]);

  const rows = rawRows.slice(headerIndex + 1).map((cells) => {
    const ticker = cells[tickerIndex]?.trim().toUpperCase() ?? "";
    const values = Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""]));
    return {
      ticker,
      daily: numeric(cells[dailyIndex] ?? ""),
      monthly: numeric(cells[monthlyIndex] ?? ""),
      return1m: numeric(cells[oneMonthIndex] ?? "", true),
      return3m: numeric(cells[threeMonthIndex] ?? "", true),
      return6m: numeric(cells[sixMonthIndex] ?? "", true),
      score: numeric(cells[scoreIndex] ?? ""),
      rank: numeric(cells[rankIndex] ?? "") || Number.MAX_SAFE_INTEGER,
      shares: sharesIndex >= 0 ? numeric(cells[sharesIndex] ?? "") : null,
      values,
    };
  }).filter((row) => row.ticker && row.ticker !== "QQQ" && row.daily > 0)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 10);

  if (!rows.length) throw new Error("投資対象の行が見つかりません");
  return { rows, headers, updatedAt: new Date().toISOString(), source: "sheet" };
}

function readCache(): GooglePortfolioData | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "null") as GooglePortfolioData | null;
    return value?.rows?.length ? { ...value, source: "cache" } : null;
  } catch {
    return null;
  }
}

export async function fetchGooglePortfolio(): Promise<GooglePortfolioData> {
  const base = `https://docs.google.com/spreadsheets/d/${PORTFOLIO_SHEET_ID}/gviz/tq`;
  const urls = [
    `${base}?tqx=out:csv&sheet=${encodeURIComponent(PORTFOLIO_SHEET_NAME)}&t=${Date.now()}`,
    `${base}?tqx=out:csv&gid=0&t=${Date.now()}`,
  ];
  let lastError: unknown;
  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = portfolioFromCsv(await response.text());
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      return data;
    } catch (error) {
      lastError = error;
    }
  }
  const cached = readCache();
  if (cached) return cached;
  throw lastError instanceof Error ? lastError : new Error("スプレッドシートを取得できません");
}
