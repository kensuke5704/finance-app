import { readFile, writeFile } from "node:fs/promises";

const cachePath = "public/price-cache.json";
const cache = JSON.parse(await readFile(cachePath, "utf8"));
const updatedAt = cache.updatedAt || new Date().toISOString();

const fundAliases = {
  "EMAXISNEO宇宙開発": "03313188",
  "ROBOPROファンド": "0931123C",
  "MEGA10": "2931225B"
};

const fallbackFundPrices = {
  "03313188": { price: 63325, symbol: "03313188", source: "fallback-yahoo-japan" },
  "0931123C": { price: 15337, symbol: "0931123C", source: "fallback-yahoo-japan" },
  "2931225B": { price: 10505, symbol: "2931225B", source: "fallback-yahoo-japan" }
};

cache.funds = cache.funds ?? {};

for (const [code, fallback] of Object.entries(fallbackFundPrices)) {
  const source = cache.funds[code];
  if (!source?.price) {
    cache.funds[code] = { ...fallback, updatedAt };
  }
}

for (const [name, code] of Object.entries(fundAliases)) {
  const source = cache.funds[code];
  if (source?.price) {
    cache.funds[name] = { ...source };
  }
}

await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`);
console.log("Mirrored fund cache entries");
