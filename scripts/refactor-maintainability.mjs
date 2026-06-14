import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  if (!source.includes(before)) {
    throw new Error(`Expected text was not found in ${path}: ${before.slice(0, 80)}`);
  }
  await writeFile(path, source.replace(before, after));
}

await mkdir("features/investments/services", { recursive: true });

await writeFile(
  "features/investments/services/refreshInvestmentState.ts",
  `import { fetchGooglePortfolio } from "../../../lib/googlePortfolio";
import { newInvestmentRecord } from "../../../lib/financeStore";
import type { FinanceState, InvestmentRecord, TickerHolding } from "../../../types/finance";
import {
  fetchLatestFundPrice,
  fundEvaluation,
  quoteSymbolForFund,
  uid,
} from "../../../components/finance/financeUtils";
import {
  SHORT_K_ASSET_ACCOUNTS,
  buildShortKAssetEvaluationNote,
  currentMonthString,
  previousMonth,
  shortKAccountDepositForMonth,
  shortKAccountPredictedValue,
  shortKAccountPrincipal,
  shortKAssetRowMatches,
} from "../../../components/finance/FinanceShared";
import type { ShortKAssetAccountKey } from "../../../components/finance/FinanceShared";

function normalizeFundName(name: string) {
  return name.normalize("NFKC").replace(/\\s+/g, "").toUpperCase();
}

function syncPortfolioHoldings(
  state: FinanceState,
  rows: Awaited<ReturnType<typeof fetchGooglePortfolio>>["rows"],
): TickerHolding[] {
  const holdings = new Map(state.tickers.map((row) => [row.ticker, row]));
  const stocks = rows.map((row) => ({
    ...(holdings.get(row.ticker) ?? {
      id: uid(),
      user_key: "personal",
      ticker: row.ticker,
      shares: 0,
    }),
    price: row.daily,
  }));
  const cash = holdings.get("CASH") ?? {
    id: uid(),
    user_key: "personal",
    ticker: "CASH",
    price: 0,
    shares: 1,
  };
  return [...stocks, cash];
}

function setAccountValue(
  state: FinanceState,
  investments: InvestmentRecord[],
  month: string,
  key: ShortKAssetAccountKey,
  value: number,
) {
  const config = SHORT_K_ASSET_ACCOUNTS[key];
  const existing = investments.find(
    (row) => row.month === month && shortKAssetRowMatches(row, config.account),
  );
  const patch = {
    capital: shortKAccountPrincipal(
      key,
      month,
      state.monthly,
      investments,
      state.settings.annualReturnRates,
    ),
    actual_balance: Math.round(value),
    predicted_balance: shortKAccountPredictedValue(
      key,
      month,
      state.monthly,
      investments,
      state.settings.annualReturnRates,
    ),
    note: buildShortKAssetEvaluationNote(existing),
  };

  if (existing) {
    return investments.map((row) =>
      row.id === existing.id ? { ...row, ...patch } : row,
    );
  }

  return [
    ...investments,
    {
      ...newInvestmentRecord(),
      month,
      account: config.account,
      ...patch,
    },
  ];
}

export async function refreshInvestmentState(state: FinanceState): Promise<FinanceState> {
  const month = currentMonthString();
  const portfolio = await fetchGooglePortfolio();
  const funds = await Promise.all(
    state.funds.map(async (fund) => {
      const price = await fetchLatestFundPrice(quoteSymbolForFund(fund));
      return typeof price === "number"
        ? { ...fund, price, last_price_updated_at: new Date().toISOString() }
        : fund;
    }),
  );
  const tickers = syncPortfolioHoldings(state, portfolio.rows);

  const fundAccountValue = funds
    .filter((fund) => {
      const name = normalizeFundName(fund.name);
      return name.includes("ROBOPRO") || name.includes("MEGA10");
    })
    .reduce((sum, fund) => sum + fundEvaluation(fund), 0);
  const emaxisValue = funds
    .filter((fund) => normalizeFundName(fund.name).includes("EMAXISNEO"))
    .reduce((sum, fund) => sum + fundEvaluation(fund), 0);
  const activeUsd = tickers.reduce(
    (sum, row) => sum + (row.ticker === "CASH" ? row.price : row.price * row.shares),
    0,
  );
  const activeAccountValue = emaxisValue + activeUsd * portfolio.usdJpy;

  const previousFx = state.investments.find(
    (row) =>
      row.month === previousMonth(month) &&
      shortKAssetRowMatches(row, SHORT_K_ASSET_ACCOUNTS.usd.account),
  );
  const previousFxValue = previousFx?.actual_balance || previousFx?.predicted_balance || 0;
  const currentFxDeposit = shortKAccountDepositForMonth("usd", month, state.monthly);
  const currentFxProfit = state.fxTrades
    .filter((trade) => trade.date.startsWith(month))
    .reduce((sum, trade) => sum + trade.result, 0);

  const baseState = { ...state, funds, tickers };
  let investments = [...state.investments];
  investments = setAccountValue(baseState, investments, month, "fund", fundAccountValue);
  investments = setAccountValue(baseState, investments, month, "active", activeAccountValue);
  investments = setAccountValue(
    baseState,
    investments,
    month,
    "usd",
    previousFxValue + currentFxDeposit + currentFxProfit,
  );

  return { ...baseState, investments };
}
`,
);

await writeFile(
  "features/investments/README.md",
  `# Investments feature

Investment data refresh orchestration belongs in this feature directory.

- UI components remain in \`components/finance\` while the current screens are gradually decomposed.
- \`services/refreshInvestmentState.ts\` owns external price synchronization and account-value aggregation.
- Storage remains owned by the application state layer, so services return a new \`FinanceState\` instead of writing to localStorage or reloading the page.
- The existing backup format and localStorage keys are intentionally unchanged.
`,
);

const shortKPath = "components/finance/ShortKAssetManagementView.tsx";
await replaceOnce(
  shortKPath,
  `import {
  fetchLatestFundPrice,
  fundEvaluation,
  money,
  quoteSymbolForFund,
  signedMoney,
  signedRate,
} from "./financeUtils";
import {
  loadFinanceState,
  newInvestmentRecord,
  persistFinanceState,
} from "../../lib/financeStore";
import { fetchGooglePortfolio } from "../../lib/googlePortfolio";`,
  `import { money, signedMoney, signedRate } from "./financeUtils";`,
);
await replaceOnce(
  shortKPath,
  `  shortKAccountDepositForMonth,
`,
  ``,
);
await replaceOnce(
  shortKPath,
  `  upsertInvestment,
  annualReturnRates,
}: {`,
  `  upsertInvestment,
  annualReturnRates,
  onRefresh,
}: {`,
);
await replaceOnce(
  shortKPath,
  `  annualReturnRates: ShortKAnnualReturnRates;
}) {`,
  `  annualReturnRates: ShortKAnnualReturnRates;
  onRefresh: () => Promise<void>;
}) {`,
);
await replaceOnce(shortKPath, `  const [refreshStatus, setRefreshStatus] = useState("");
`, ``);
await replaceOnce(
  shortKPath,
  `
  useEffect(() => {
    const completed = window.sessionStorage.getItem("finance.investmentRefreshStatus");
    if (!completed) return;
    window.sessionStorage.removeItem("finance.investmentRefreshStatus");
    setRefreshStatus(completed);
  }, []);
`,
  ``,
);
{
  const source = await readFile(shortKPath, "utf8");
  const start = source.indexOf("  async function refreshAllInvestments() {");
  const end = source.indexOf("\n\n  return (", start);
  if (start < 0 || end < 0) throw new Error("refreshAllInvestments block not found");
  const replacement = `  async function refreshAllInvestments() {
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error("Investment refresh failed", error);
    } finally {
      setRefreshing(false);
    }
  }`;
  await writeFile(shortKPath, source.slice(0, start) + replacement + source.slice(end));
}
{
  const source = await readFile(shortKPath, "utf8");
  const statusStart = source.indexOf("        {refreshStatus && (");
  const bodyStart = source.indexOf('        <div className="flat-panel-body">', statusStart);
  if (statusStart < 0 || bodyStart < 0) throw new Error("refresh status markup not found");
  await writeFile(shortKPath, source.slice(0, statusStart) + source.slice(bodyStart));
}

const pagePath = "app/page.tsx";
await replaceOnce(
  pagePath,
  `import { calculateMomentumSnapshot, DEFAULT_MOMENTUM_SETTINGS } from "../lib/momentumEngine";
`,
  `import { calculateMomentumSnapshot, DEFAULT_MOMENTUM_SETTINGS } from "../lib/momentumEngine";
import { refreshInvestmentState } from "../features/investments/services/refreshInvestmentState";
`,
);
await replaceOnce(
  pagePath,
  `  function updateMonthly(row: MonthlyRecord) {`,
  `  async function refreshAllInvestments() {
    const refreshed = await refreshInvestmentState(state);
    setState(refreshed);
  }

  function updateMonthly(row: MonthlyRecord) {`,
);
await replaceOnce(
  pagePath,
  `                  annualReturnRates={state.settings.annualReturnRates}
                />`,
  `                  annualReturnRates={state.settings.annualReturnRates}
                  onRefresh={refreshAllInvestments}
                />`,
);

const momentumPath = "components/finance/MomentumView.tsx";
await replaceOnce(momentumPath, `  refreshStatus,
`, ``);
await replaceOnce(
  momentumPath,
  `  refreshStatus?: { type: "syncing" | "success" | "error"; text: string } | null;
`,
  ``,
);
{
  const source = await readFile(momentumPath, "utf8");
  const statusStart = source.indexOf("      {refreshStatus && (");
  const bodyStart = source.indexOf('      <div className="composition-body">', statusStart);
  if (statusStart < 0 || bodyStart < 0) throw new Error("composition refresh status markup not found");
  await writeFile(momentumPath, source.slice(0, statusStart) + source.slice(bodyStart));
}
await replaceOnce(
  momentumPath,
  `  const [refreshStatus, setRefreshStatus] = useState<{
    type: "syncing" | "success" | "error";
    text: string;
  } | null>(null);
`,
  ``,
);
await replaceOnce(momentumPath, `  async function loadSheet(showConfirmation = false) {`, `  async function loadSheet() {`);
await replaceOnce(
  momentumPath,
  `    if (showConfirmation) {
      setRefreshStatus({ type: "syncing", text: "スプレッドシートと同期しています…" });
    }
`,
  ``,
);
{
  const source = await readFile(momentumPath, "utf8");
  const successStart = source.indexOf("      if (showConfirmation) {", source.indexOf("async function loadSheet"));
  const catchStart = source.indexOf("    } catch (error) {", successStart);
  if (successStart < 0 || catchStart < 0) throw new Error("active refresh success block not found");
  let next = source.slice(0, successStart) + source.slice(catchStart);
  const errorStatus = `      if (showConfirmation) {
        setRefreshStatus({ type: "error", text: "更新できませんでした" });
      }
`;
  if (!next.includes(errorStatus)) throw new Error("active refresh error status block not found");
  next = next.replace(errorStatus, "");
  next = next.replace("onRefresh={() => void loadSheet(true)}", "onRefresh={() => void loadSheet()}");
  next = next.replace("          refreshStatus={refreshStatus}\n", "");
  await writeFile(momentumPath, next);
}

await rm("scripts/refactor-maintainability.mjs");
await rm(".github/workflows/refactor-maintainability.yml");
