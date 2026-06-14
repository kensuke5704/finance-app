"use client";

import { useEffect, useState } from "react";
import type { InvestmentRecord, MonthlyRecord } from "../../types/finance";
import {
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
import { fetchGooglePortfolio } from "../../lib/googlePortfolio";
import type { ShortKAssetAccountKey, ShortKAnnualReturnRates } from "./FinanceShared";
import {
  SHORT_K_ASSET_ACCOUNTS,
  SHORT_K_END,
  SHORT_K_START,
  MoneyInput,
  buildShortKAssetEvaluationNote,
  currentMonthString,
  getShortKAssetRows,
  inMonthRange,
  shortKAccountDepositForMonth,
  shortKAccountPredictedValue,
  shortKAccountPrincipal,
  shortKAssetActualSummary,
  shortKAssetRowMatches,
  shortKAssetSummary,
  shortKMonthOptions,
  shortKYearOptions,
} from "./FinanceShared";

function previousMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function ShortKAssetManagementView({
  rows,
  detailRows,
  selectedMonth,
  setSelectedMonth,
  upsertInvestment,
  annualReturnRates,
}: {
  rows: MonthlyRecord[];
  detailRows: InvestmentRecord[];
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  upsertInvestment: (
    month: string,
    account: string,
    patch: Partial<InvestmentRecord>,
  ) => void;
  annualReturnRates: ShortKAnnualReturnRates;
}) {
  const defaultSelectedMonth = selectedMonth || currentMonthString();
  const [selectedYear, setSelectedYear] = useState(defaultSelectedMonth.slice(0, 4));
  const [selectedMonthNumber, setSelectedMonthNumber] = useState(defaultSelectedMonth.slice(5, 7));
  const [openAssetAccounts, setOpenAssetAccounts] = useState<Record<ShortKAssetAccountKey, boolean>>({
    fund: false,
    active: false,
    usd: false,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState("");

  useEffect(() => {
    const nextSelectedMonth = selectedMonth || currentMonthString();
    setSelectedYear(nextSelectedMonth.slice(0, 4));
    setSelectedMonthNumber(nextSelectedMonth.slice(5, 7));
  }, [selectedMonth]);

  useEffect(() => {
    const completed = window.sessionStorage.getItem("finance.investmentRefreshStatus");
    if (!completed) return;
    window.sessionStorage.removeItem("finance.investmentRefreshStatus");
    setRefreshStatus(completed);
  }, []);

  const selectedMonthKey = selectedYear && selectedMonthNumber ? `${selectedYear}-${selectedMonthNumber}` : "";
  const selectedAssetRows = selectedMonthKey ? getShortKAssetRows(detailRows, selectedMonthKey) : [];
  const selectedAssetSummary = selectedMonthKey
    ? shortKAssetActualSummary(selectedMonthKey, rows, detailRows)
    : { principal: 0, value: 0, profit: 0, hasEvaluation: false };
  const predictedAssetSummary = selectedMonthKey
    ? shortKAssetSummary(selectedMonthKey, rows, detailRows, annualReturnRates)
    : { principal: 0, value: 0, profit: 0 };
  const isPredictedSummary = !selectedAssetSummary.hasEvaluation;
  const displayAssetValue = selectedAssetSummary.hasEvaluation
    ? selectedAssetSummary.value
    : predictedAssetSummary.value;
  const displayAssetProfit = selectedAssetSummary.hasEvaluation
    ? selectedAssetSummary.profit
    : predictedAssetSummary.value - selectedAssetSummary.principal;
  const displayProfitRate = signedRate(displayAssetProfit, selectedAssetSummary.principal);

  const updateSelectedYear = (year: string) => {
    setSelectedYear(year);
    if (!year) {
      setSelectedMonthNumber("");
      setSelectedMonth("");
      return;
    }
    if (selectedMonthNumber && shortKMonthOptions(year).includes(selectedMonthNumber)) {
      setSelectedMonth(`${year}-${selectedMonthNumber}`);
    } else {
      setSelectedMonthNumber("");
      setSelectedMonth("");
    }
  };

  const updateSelectedMonthNumber = (month: string) => {
    setSelectedMonthNumber(month);
    if (!selectedYear || !month) {
      setSelectedMonth("");
      return;
    }
    setSelectedMonth(`${selectedYear}-${month}`);
  };

  const moveSelectedShortKMonth = (diff: number) => {
    if (!selectedMonthKey) return;
    const [year, month] = selectedMonthKey.split("-").map(Number);
    const date = new Date(year, month - 1 + diff, 1);
    const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!inMonthRange(next)) return;
    setSelectedMonth(next);
  };

  const toggleAssetAccount = (key: ShortKAssetAccountKey) => {
    setOpenAssetAccounts((current) => ({ ...current, [key]: !current[key] }));
  };

  const updateAssetValue = (account: ShortKAssetAccountKey, value: number) => {
    if (!selectedMonthKey) return;
    const config = SHORT_K_ASSET_ACCOUNTS[account];
    const currentRow = selectedAssetRows.find((row) => shortKAssetRowMatches(row, config.account));
    upsertInvestment(selectedMonthKey, config.account, {
      capital: shortKAccountPrincipal(account, selectedMonthKey, rows, detailRows, annualReturnRates),
      actual_balance: value,
      predicted_balance: shortKAccountPredictedValue(account, selectedMonthKey, rows, detailRows, annualReturnRates),
      note: buildShortKAssetEvaluationNote(currentRow),
    });
  };

  async function refreshAllInvestments() {
    setRefreshing(true);
    setRefreshStatus("投資内の全データを更新しています…");
    try {
      const month = currentMonthString();
      const stored = await loadFinanceState();
      const portfolio = await fetchGooglePortfolio();
      const updatedFunds = await Promise.all(
        stored.funds.map(async (fund) => {
          const price = await fetchLatestFundPrice(quoteSymbolForFund(fund));
          return typeof price === "number"
            ? { ...fund, price, last_price_updated_at: new Date().toISOString() }
            : fund;
        }),
      );
      const holdings = new Map(stored.tickers.map((row) => [row.ticker, row]));
      const updatedTickers = [
        ...portfolio.rows.map((row) => ({
          ...(holdings.get(row.ticker) ?? {
            id: `${Date.now()}-${row.ticker}`,
            user_key: "personal",
            ticker: row.ticker,
            shares: 0,
          }),
          price: row.daily,
        })),
        holdings.get("CASH") ?? {
          id: `${Date.now()}-CASH`,
          user_key: "personal",
          ticker: "CASH",
          price: 0,
          shares: 1,
        },
      ];
      const normalizeName = (name: string) =>
        name.normalize("NFKC").replace(/\s+/g, "").toUpperCase();
      const fundAccountValue = updatedFunds
        .filter((fund) => {
          const name = normalizeName(fund.name);
          return name.includes("ROBOPRO") || name.includes("MEGA10");
        })
        .reduce((sum, fund) => sum + fundEvaluation(fund), 0);
      const emaxisValue = updatedFunds
        .filter((fund) => normalizeName(fund.name).includes("EMAXISNEO"))
        .reduce((sum, fund) => sum + fundEvaluation(fund), 0);
      const activeUsd = updatedTickers.reduce(
        (sum, row) => sum + (row.ticker === "CASH" ? row.price : row.price * row.shares),
        0,
      );
      const activeAccountValue = emaxisValue + activeUsd * portfolio.usdJpy;
      const previousFx = stored.investments.find(
        (row) => row.month === previousMonth(month) && shortKAssetRowMatches(row, SHORT_K_ASSET_ACCOUNTS.usd.account),
      );
      const previousFxValue = previousFx?.actual_balance || previousFx?.predicted_balance || 0;
      const currentFxDeposit = shortKAccountDepositForMonth("usd", month, stored.monthly);
      const currentFxProfit = stored.fxTrades
        .filter((trade) => trade.date.startsWith(month))
        .reduce((sum, trade) => sum + trade.result, 0);
      const fxAccountValue = previousFxValue + currentFxDeposit + currentFxProfit;
      let investments = [...stored.investments];

      const setAccountValue = (key: ShortKAssetAccountKey, value: number) => {
        const config = SHORT_K_ASSET_ACCOUNTS[key];
        const existing = investments.find(
          (row) => row.month === month && shortKAssetRowMatches(row, config.account),
        );
        const patch = {
          capital: shortKAccountPrincipal(
            key,
            month,
            stored.monthly,
            investments,
            stored.settings.annualReturnRates,
          ),
          actual_balance: Math.round(value),
          predicted_balance: shortKAccountPredictedValue(
            key,
            month,
            stored.monthly,
            investments,
            stored.settings.annualReturnRates,
          ),
          note: buildShortKAssetEvaluationNote(existing),
        };
        if (existing) {
          investments = investments.map((row) =>
            row.id === existing.id ? { ...row, ...patch } : row,
          );
        } else {
          investments.push({
            ...newInvestmentRecord(),
            month,
            account: config.account,
            ...patch,
          });
        }
      };

      setAccountValue("fund", fundAccountValue);
      setAccountValue("active", activeAccountValue);
      setAccountValue("usd", fxAccountValue);
      await persistFinanceState({
        ...stored,
        funds: updatedFunds,
        tickers: updatedTickers,
        investments,
      });
      const time = new Date().toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      });
      window.sessionStorage.setItem(
        "finance.investmentRefreshStatus",
        `✓ 投資を更新しました・${time}`,
      );
      window.location.reload();
    } catch (error) {
      setRefreshStatus(
        `更新できませんでした: ${error instanceof Error ? error.message : String(error)}`,
      );
      setRefreshing(false);
    }
  }

  return (
    <section className="stack">
      <div className="flat-panel">
        <div className="flat-panel-head">
          <div className="panel-title">総合</div>
          <button className="btn" type="button" disabled={refreshing} onClick={() => void refreshAllInvestments()}>
            {refreshing ? "更新中…" : "更新"}
          </button>
        </div>
        {refreshStatus && (
          <div
            className={`composition-refresh-status ${
              refreshStatus.startsWith("✓") ? "success" : refreshing ? "syncing" : "error"
            }`}
            role="status"
            aria-live="polite"
          >
            {refreshStatus}
          </div>
        )}
        <div className="flat-panel-body">
          <div className="month-picker-row">
            <button className="month-arrow" type="button" onClick={() => moveSelectedShortKMonth(-1)} disabled={!selectedMonthKey || selectedMonthKey <= SHORT_K_START}>←</button>
            <div className="month-select-grid">
              <label className="field">
                <span className="label">年</span>
                <select className="input editable-input" value={selectedYear} onChange={(e) => updateSelectedYear(e.target.value)}>
                  <option value="">選択</option>
                  {shortKYearOptions().map((year) => <option key={year} value={year}>{year}年</option>)}
                </select>
              </label>
              <label className="field">
                <span className="label">月</span>
                <select className="input editable-input" value={selectedMonthNumber} onChange={(e) => updateSelectedMonthNumber(e.target.value)} disabled={!selectedYear}>
                  <option value="">選択</option>
                  {shortKMonthOptions(selectedYear).map((monthOption) => <option key={monthOption} value={monthOption}>{Number(monthOption)}月</option>)}
                </select>
              </label>
            </div>
            <button className="month-arrow" type="button" onClick={() => moveSelectedShortKMonth(1)} disabled={!selectedMonthKey || selectedMonthKey >= SHORT_K_END}>→</button>
          </div>

          {!selectedMonthKey ? (
            <div className="empty-state">年と月を選択してください。</div>
          ) : (
            <div className="stack">
              <div className={`flat-summary-block ${isPredictedSummary ? "prediction-summary" : ""}`}>
                <div className="budget-actual-label">総合</div>
                <div className="flat-summary-grid">
                  <div><span className="mini-label">元本合計</span><b>{money(selectedAssetSummary.principal)}</b></div>
                  <div><span className="mini-label">{selectedAssetSummary.hasEvaluation ? "評価額合計" : "予測額"}</span><b>{money(displayAssetValue)}</b></div>
                </div>
                <div className="flat-result-row">
                  <span>{selectedAssetSummary.hasEvaluation ? "損益" : "予測損益"}</span>
                  <b className={displayAssetProfit < 0 ? "negative" : "positive"}>{signedMoney(displayAssetProfit)}（{displayProfitRate}）</b>
                </div>
              </div>

              {(Object.keys(SHORT_K_ASSET_ACCOUNTS) as ShortKAssetAccountKey[]).map((key) => {
                const config = SHORT_K_ASSET_ACCOUNTS[key];
                const row = selectedAssetRows.find((item) => shortKAssetRowMatches(item, config.account));
                const principal = shortKAccountPrincipal(key, selectedMonthKey, rows, detailRows, annualReturnRates);
                const hasEvaluation = !!row && row.actual_balance !== 0;
                const evaluation = hasEvaluation ? row.actual_balance : 0;
                const predictedValue = shortKAccountPredictedValue(key, selectedMonthKey, rows, detailRows, annualReturnRates);
                const profit = hasEvaluation ? evaluation - principal : predictedValue - principal;
                const profitRate = signedRate(profit, principal);

                return (
                  <div className="short-k-input-section" key={key}>
                    <button className="short-k-input-section-head" type="button" onClick={() => toggleAssetAccount(key)}>
                      <span>{openAssetAccounts[key] ? "▼" : "▶"} {config.label}</span>
                    </button>
                    {openAssetAccounts[key] && (
                      <div className={`short-k-input-section-body ${!hasEvaluation ? "prediction-account" : ""}`}>
                        <div className="flat-account-input">
                          <div className="budget-actual-label">{config.label}</div>
                          <div className="budget-actual-two-col">
                            <div className="readonly-box flat-readonly-box"><span className="mini-label">元本</span><b>{money(principal)}</b></div>
                            <label className="actual-input-box flat-input-box"><span className="mini-label">評価額</span><MoneyInput value={evaluation} onChange={(nextValue) => updateAssetValue(key, nextValue)} /></label>
                          </div>
                        </div>
                        <div className="flat-result-row compact">
                          <span>{hasEvaluation ? "損益" : "予測損益"}</span>
                          <b className={profit < 0 ? "negative" : "positive"}>{signedMoney(profit)}（{profitRate}）</b>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
