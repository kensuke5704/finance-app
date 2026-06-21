import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outputPath = path.join(root, "public", "usdjpy-history.json");
const startDate = "2020-01-01";

function toEpochSeconds(dateString) {
  return Math.floor(new Date(`${dateString}T00:00:00Z`).getTime() / 1000);
}

function dateFromUnix(timestamp) {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

async function main() {
  const period1 = toEpochSeconds(startDate);
  const period2 = Math.floor(Date.now() / 1000) + 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/USDJPY=X?period1=${period1}&period2=${period2}&interval=1d&events=history`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 finance-app fx-data-updater",
      accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(`Yahoo response ${response.status}`);

  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const rows = timestamps.flatMap((timestamp, index) => {
    const close = closes[index];
    if (typeof close !== "number" || !Number.isFinite(close) || close <= 0) return [];
    return [{ date: dateFromUnix(timestamp), close: Number(close.toFixed(4)) }];
  });
  if (!rows.length) throw new Error("USD/JPY history is empty");

  const latestFromMeta = result?.meta?.regularMarketPrice;
  const latest =
    typeof latestFromMeta === "number" && Number.isFinite(latestFromMeta)
      ? latestFromMeta
      : rows.at(-1).close;
  const next = {
    symbol: "USDJPY=X",
    pair: "USD/JPY",
    source: "Yahoo Finance",
    updatedAt: new Date().toISOString(),
    latest: Number(latest.toFixed(4)),
    rows,
  };
  await fs.writeFile(outputPath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Updated USD/JPY: ${next.latest} (${rows.length} daily rows)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
