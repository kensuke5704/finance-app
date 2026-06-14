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

type SheetEntry = { row: string[]; labelIndex: number };
type VisualizationResponse = {
  status?: string;
  errors?: { detailed_message?: string; message?: string }[];
  table?: {
    cols?: { label?: string; id?: string }[];
    rows?: { c?: ({ v?: unknown; f?: string } | null)[] }[];
  };
};

function normalize(value: string) {
  return value.normalize("NFKC").trim().toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]/g, "");
}

function matches(value: string, aliases: string[]) {
  const target = normalize(value);
  return Boolean(target) && aliases.map(normalize).some(
    (alias) => target === alias || target.includes(alias),
  );
}

function findColumn(headers: string[], aliases: string[]) {
  return headers.findIndex((header) => matches(header, aliases));
}

function findRow(rows: string[][], aliases: string[]): SheetEntry | null {
  for (const row of rows) {
    const labelIndex = row.findIndex((cell) => matches(cell, aliases));
    if (labelIndex >= 0) return { row, labelIndex };
  }
  return null;
}

function numeric(value: string, percent = false) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = Number(trimmed.replace(/[$¥￥,\s]/g, "").replace(/%|％/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return percent && /%|％/.test(trimmed) ? parsed / 100 : parsed;
}

function result(rows: GooglePortfolioRow[], headers: string[]): GooglePortfolioData {
  if (!rows.length) throw new Error("Tickerは見つかりましたが、Dailyの価格を読み取れません");
  return {
    rows: rows.sort((a, b) => a.rank - b.rank).slice(0, 10),
    headers,
    updatedAt: new Date().toISOString(),
    source: "sheet",
  };
}

function fromColumnLayout(rawRows: string[][]): GooglePortfolioData | null {
  const headerIndex = rawRows.findIndex(
    (row) => row.some((cell) => matches(cell, ["Ticker", "ティッカー", "銘柄"]))
      && row.some((cell) => matches(cell, ["Daily", "現在値", "Current", "Price"])),
  );
  if (headerIndex < 0) return null;

  const headers = rawRows[headerIndex].map((value) => value.trim());
  const ticker = findColumn(headers, ["Ticker", "ティッカー", "銘柄"]);
  const daily = findColumn(headers, ["Daily", "現在値", "Current", "Price"]);
  const monthly = findColumn(headers, ["Monthly", "基準値", "Base"]);
  const one = findColumn(headers, ["1M", "1か月", "1ヶ月"]);
  const three = findColumn(headers, ["3M", "3か月", "3ヶ月"]);
  const six = findColumn(headers, ["6M", "6か月", "6ヶ月"]);
  const score = findColumn(headers, ["Score", "スコア"]);
  const rank = findColumn(headers, ["Rank", "順位"]);
  const shares = findColumn(headers, ["Shares", "保有数", "株数", "Quantity"]);

  const rows = rawRows.slice(headerIndex + 1).map((cells, index) => ({
    ticker: cells[ticker]?.trim().toUpperCase() ?? "",
    daily: numeric(cells[daily] ?? ""),
    monthly: numeric(cells[monthly] ?? ""),
    return1m: numeric(cells[one] ?? "", true),
    return3m: numeric(cells[three] ?? "", true),
    return6m: numeric(cells[six] ?? "", true),
    score: numeric(cells[score] ?? ""),
    rank: numeric(cells[rank] ?? "") || index + 1,
    shares: shares >= 0 ? numeric(cells[shares] ?? "") : null,
    values: Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex]?.trim() ?? ""])),
  })).filter((row) => row.ticker && row.ticker !== "QQQ" && row.daily > 0);

  return result(rows, headers);
}

function fromRowLayout(rawRows: string[][]): GooglePortfolioData | null {
  const ticker = findRow(rawRows, ["Ticker", "ティッカー", "銘柄"]);
  const daily = findRow(rawRows, ["Daily", "現在値", "Current", "Price"]);
  if (!ticker || !daily) return null;

  const metrics: Record<string, SheetEntry | null> = {
    Daily: daily,
    Monthly: findRow(rawRows, ["Monthly", "基準値", "Base"]),
    "1M": findRow(rawRows, ["1M", "1か月", "1ヶ月"]),
    "3M": findRow(rawRows, ["3M", "3か月", "3ヶ月"]),
    "6M": findRow(rawRows, ["6M", "6か月", "6ヶ月"]),
    Score: findRow(rawRows, ["Score", "スコア"]),
    Rank: findRow(rawRows, ["Rank", "順位"]),
    Shares: findRow(rawRows, ["Shares", "保有数", "株数", "Quantity"]),
  };
  const rows = ticker.row.map((cell, column) => ({ ticker: cell.trim().toUpperCase(), column }))
    .filter(({ ticker: symbol, column }) => column > ticker.labelIndex && symbol && symbol !== "QQQ")
    .map(({ ticker: symbol, column }, index) => {
      const offset = column - ticker.labelIndex;
      const valueAt = (entry: SheetEntry | null) => entry?.row[entry.labelIndex + offset]?.trim() ?? "";
      const values: Record<string, string> = { Ticker: symbol };
      Object.entries(metrics).forEach(([label, entry]) => {
        if (entry) values[label] = valueAt(entry);
      });
      return {
        ticker: symbol,
        daily: numeric(valueAt(metrics.Daily)),
        monthly: numeric(valueAt(metrics.Monthly)),
        return1m: numeric(valueAt(metrics["1M"]), true),
        return3m: numeric(valueAt(metrics["3M"]), true),
        return6m: numeric(valueAt(metrics["6M"]), true),
        score: numeric(valueAt(metrics.Score)),
        rank: numeric(valueAt(metrics.Rank)) || index + 1,
        shares: metrics.Shares ? numeric(valueAt(metrics.Shares)) : null,
        values,
      };
    }).filter((row) => row.daily > 0);

  return result(rows, ["Ticker", ...Object.keys(metrics)]);
}

function sampleCells(rows: string[][]) {
  return Array.from(new Set(
    rows.flat().map((value) => value.trim())
      .filter((value) => value && !/^[A-Z]{1,3}$/.test(value)),
  )).slice(0, 30).join(" / ");
}

function parseRows(rawRows: string[][]) {
  const columnLayout = fromColumnLayout(rawRows);
  if (columnLayout) return columnLayout;
  const rowLayout = fromRowLayout(rawRows);
  if (rowLayout) return rowLayout;
  const sample = sampleCells(rawRows);
  throw new Error(
    `TickerとDailyを特定できません${sample ? `（取得項目: ${sample}）` : "（取得データが空です）"}`,
  );
}

function cellText(cell: { v?: unknown; f?: string } | null | undefined) {
  if (!cell) return "";
  if (typeof cell.f === "string") return cell.f;
  return cell.v === null || cell.v === undefined ? "" : String(cell.v);
}

function fromVisualization(response: VisualizationResponse) {
  if (response.status === "error") {
    const message = response.errors?.[0]?.detailed_message ?? response.errors?.[0]?.message;
    throw new Error(message || "Googleスプレッドシートからエラーが返されました");
  }
  if (!response.table?.rows) throw new Error("スプレッドシートの表を取得できません");
  const labels = (response.table.cols ?? []).map((column) => column.label || column.id || "");
  const rows = response.table.rows.map((row) => (row.c ?? []).map(cellText));
  return parseRows(labels.some(Boolean) ? [labels, ...rows] : rows);
}

function fetchByJsonp(params: { gid?: string; sheet?: string; range?: string; headers?: string }): Promise<GooglePortfolioData> {
  return new Promise((resolve, reject) => {
    const callback = `financeSheetCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const cleanup = () => {
      window.clearTimeout(timeout);
      script.remove();
      delete (window as typeof window & Record<string, unknown>)[callback];
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("スプレッドシートの応答がタイムアウトしました"));
    }, 15000);

    (window as typeof window & Record<string, unknown>)[callback] = (response: VisualizationResponse) => {
      try {
        const data = fromVisualization(response);
        cleanup();
        resolve(data);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    const query = new URLSearchParams({
      headers: params.headers ?? "0",
      tq: "select *",
      tqx: `responseHandler:${callback}`,
      t: String(Date.now()),
    });
    if (params.gid) query.set("gid", params.gid);
    if (params.sheet) query.set("sheet", params.sheet);
    if (params.range) query.set("range", params.range);
    script.src = `https://docs.google.com/spreadsheets/d/${PORTFOLIO_SHEET_ID}/gviz/tq?${query}`;
    script.onerror = () => {
      cleanup();
      reject(new Error("Googleスプレッドシートへ接続できません"));
    };
    document.head.appendChild(script);
  });
}

function readCache(): GooglePortfolioData | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "null") as GooglePortfolioData | null;
    return cached?.rows?.length ? { ...cached, source: "cache" } : null;
  } catch {
    return null;
  }
}

export async function fetchGooglePortfolio(): Promise<GooglePortfolioData> {
  const attempts = [
    { gid: "0", range: "A1:ZZ1000", headers: "0" },
    { gid: "0", range: "A1:ZZ1000", headers: "1" },
    { gid: "0", range: "A1:ZZ1000", headers: "2" },
    { sheet: PORTFOLIO_SHEET_NAME, range: "A1:ZZ1000", headers: "0" },
    { sheet: PORTFOLIO_SHEET_NAME, range: "A1:ZZ1000", headers: "1" },
    { sheet: "ポートフォリオページ", range: "A1:ZZ1000", headers: "0" },
    { sheet: "Portfolio", range: "A1:ZZ1000", headers: "0" },
    { gid: "0", range: PORTFOLIO_SHEET_NAME },
    { sheet: PORTFOLIO_SHEET_NAME },
    { sheet: "ポートフォリオページ" },
    { sheet: "Portfolio" },
    { gid: "0" },
  ];
  const errors: string[] = [];

  for (const params of attempts) {
    try {
      const data = await fetchByJsonp(params);
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      return data;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const cached = readCache();
  if (cached) return cached;
  throw new Error(Array.from(new Set(errors)).join(" / ") || "スプレッドシートを取得できません");
}
