import { readFile, writeFile } from "node:fs/promises";

const cachePath = "public/price-cache.json";
const cache = JSON.parse(await readFile(cachePath, "utf8"));

const fundAliases = {
  "EMAXISNEO宇宙開発": "03313188",
  "ROBOPROファンド": "0931123C",
  "MEGA10": "2931225B"
};

cache.funds = cache.funds ?? {};

for (const [name, code] of Object.entries(fundAliases)) {
  const source = cache.funds[code];
  if (source?.price) {
    cache.funds[name] = { ...source };
  }
}

await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`);
console.log("Mirrored fund cache entries");
