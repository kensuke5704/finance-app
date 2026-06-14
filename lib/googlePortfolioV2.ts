export const PORTFOLIO_SHEET_ID = "15cABJhz4OqKxfxu6qDcne5SoDTb8qm1DbHn5fzwFCUM";
export const PORTFOLIO_PUBLISHED_ID =
  "2PACX-1vQxctP3RpvsIA1hMIiX_jiXmaxrR-DhutEDwCUsnd-aOkR7c5JepKAhwIzI-HpuziBr3_tVM6vXk4Or";

const CACHE_KEY = "finance.googlePortfolio.v2";

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
  usdJpy: number;
  updatedAt: string;
  source: "sheet" | "cache";
};

type SheetRow = { row: string[]; labelIndex: number };
type VisualizationResponse = {
  status?: string;
  errors?: { detailed_message?: string; message?: string }[];
  table?: {
    cols?: { label?: string; id?: string }[];
    rows?: { c?: ({ v?: unknown; f?: string } | null)[] }[];
  };
};

function normalize(value: string) {
  return value.normalize("NFKC").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findRow(rows: string[][], label: string): SheetRow | null {
  const expected = normalize(label);
  for (const row of rows) {
    const labelIndex = row.findIndex((cell) => normalize(cell) === expected);
    if (labelIndex >= 0) return { row, labelIndex };
  }
  return null;
}

function numeric(value: string) {
  const match = value.trim().replace(/[−–—]/g, "-").replace(/[$¥￥,\s%％]/g, "")
    .match(/[-+]?(?:\d+\.?\d*|\.\d+)/);
  return match ? Number(match[0]) : 0;
}

function parsePortfolio(rows: string[][]): GooglePortfolioData {
  const ticker = findRow(rows, "Ticker");
  const daily = findRow(rows, "Daily");
  const monthly = findRow(rows, "Monthly");
  const oneMonth = findRow(rows, "1M");
  const threeMonth = findRow(rows, "3M");
  const sixMonth = findRow(rows, "6M");
  const score = findRow(rows, "Score");
  const rank = findRow(rows, "Rank");
  const totalUsd = findRow(rows, "Total(USD)");
  const totalJpy = findRow(rows, "Total(JPY)");

  if (!ticker || !daily) {
    const labels = rows.map((row) => row[0]?.trim()).filter(Boolean).slice(0, 15);
    throw new Error(`Portfolio!A1:K17の行を確認できません（${labels.join(" / ") || "空"}）`);
  }

  const valueAt = (entry: SheetRow | null, offset: number) =>
    entry?.row[entry.labelIndex + offset]?.trim() ?? "";
  const usdTotal = numeric(valueAt(totalUsd, 1));
  const jpyTotal = numeric(valueAt(totalJpy, 1));
  const usdJpy = usdTotal > 0 ? jpyTotal / usdTotal : 0;
  if (usdJpy <= 0) {
    throw new Error("PortfolioのTotal(JPY) / Total(USD)からUSD/JPYを計算できません");
  }

  const parsed = ticker.row.slice(ticker.labelIndex + 1, ticker.labelIndex + 11)
    .map((cell, index) => {
      const offset = index + 1;
      const symbol = cell.trim().toUpperCase();
      const values = {
        Ticker: symbol,
        Daily: valueAt(daily, offset),
        Monthly: valueAt(monthly, offset),
        "1M": valueAt(oneMonth, offset),
        "3M": valueAt(threeMonth, offset),
        "6M": valueAt(sixMonth, offset),
        Score: valueAt(score, offset),
        Rank: valueAt(rank, offset),
      };
      return {
        ticker: symbol,
        daily: numeric(values.Daily),
        monthly: numeric(values.Monthly),
        return1m: numeric(values["1M"]),
        return3m: numeric(values["3M"]),
        return6m: numeric(values["6M"]),
        score: numeric(values.Score),
        rank: numeric(values.Rank) || index + 1,
        shares: null,
        values,
      };
    })
    .filter((row) => row.ticker && row.daily > 0)
    .sort((a, b) => a.rank - b.rank);

  if (parsed.length !== 10) {
    throw new Error(`Portfolio!A1:K10から読み取れた銘柄は${parsed.length}件です`);
  }
  return {
    rows: parsed,
    headers: ["Ticker", "Daily", "Monthly", "1M", "3M", "6M", "Score", "Rank"],
    usdJpy,
    updatedAt: new Date().toISOString(),
    source: "sheet",
  };
}

function cellText(cell: { v?: unknown; f?: string } | null | undefined) {
  if (!cell) return "";
  if (typeof cell.f === "string") return cell.f;
  return cell.v === null || cell.v === undefined ? "" : String(cell.v);
}

function parseResponse(response: VisualizationResponse) {
  if (response.status === "error") {
    const message = response.errors?.[0]?.detailed_message ?? response.errors?.[0]?.message;
    throw new Error(message || "Googleスプレッドシートからエラーが返されました");
  }
  if (!response.table?.rows) throw new Error("Portfolioシートの表を取得できません");
  const labels = (response.table.cols ?? []).map((column) => column.label || column.id || "");
  const rows = response.table.rows.map((row) => (row.c ?? []).map(cellText));
  return parsePortfolio(labels.some((label) => normalize(label) === "ticker") ? [labels, ...rows] : rows);
}

function fetchJsonp(published: boolean, headers: string): Promise<GooglePortfolioData> {
  return new Promise((resolve, reject) => {
    const callback = `financePortfolio_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const cleanup = () => {
      window.clearTimeout(timeout);
      script.remove();
      delete (window as typeof window & Record<string, unknown>)[callback];
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Portfolioシートの応答がタイムアウトしました"));
    }, 15000);

    (window as typeof window & Record<string, unknown>)[callback] = (response: VisualizationResponse) => {
      try {
        const data = parseResponse(response);
        cleanup();
        resolve(data);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    const query = new URLSearchParams({
      sheet: "Portfolio",
      range: "A1:K17",
      headers,
      tq: "select *",
      tqx: `responseHandler:${callback}`,
      t: String(Date.now()),
    });
    const source = published
      ? `https://docs.google.com/spreadsheets/d/e/${PORTFOLIO_PUBLISHED_ID}`
      : `https://docs.google.com/spreadsheets/d/${PORTFOLIO_SHEET_ID}`;
    script.src = `${source}/gviz/tq?${query}`;
    script.onerror = () => {
      cleanup();
      reject(new Error("Portfolioシートへ接続できません"));
    };
    document.head.appendChild(script);
  });
}

function readCache(): GooglePortfolioData | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "null") as GooglePortfolioData | null;
    return cached?.rows?.length === 10 && cached.usdJpy > 0
      ? { ...cached, source: "cache" }
      : null;
  } catch {
    return null;
  }
}

export async function fetchGooglePortfolio(): Promise<GooglePortfolioData> {
  const errors: string[] = [];
  for (const [published, headers] of [[true, "0"], [true, "1"], [false, "0"], [false, "1"]] as const) {
    try {
      const data = await fetchJsonp(published, headers);
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      return data;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  const cached = readCache();
  if (cached) return cached;
  throw new Error(Array.from(new Set(errors)).join(" / "));
}
