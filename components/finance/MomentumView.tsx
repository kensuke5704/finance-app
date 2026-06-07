"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ProductAddDialog } from "./FxView";
import {
  fundNames,
  investmentAccounts,
  newMonthlyRecord,
} from "../../lib/financeStore";
import type {
  FinanceState,
  FundRecord,
  FxRiskInput,
  FxTrade,
  InvestmentRecord,
  MonthlyRecord,
  TickerHolding,
} from "../../types/finance";
import {
  AllocationPanel,
  AssetCards,
  buildInvestmentAccountSeries,
  buildInvestmentMonthlySeries,
  FundTable,
  FxTable,
  InvestmentTable,
  LongPlanTable,
  TickerTable,
} from "./FinanceTables";
import {
  CollapsiblePanel,
  LineLikeChart,
  MemoMonthlyTable,
  MultiLineChart,
} from "./FinanceCharts";
import {
  actualCash,
  actualIncome,
  actualInvest,
  actualOutgo,
  fetchLatestJapanFundPrice,
  fetchLatestMarketPrice,
  formatCount,
  formatMoneyInput,
  fundEvaluation,
  investmentValue,
  money,
  n,
  netAssets,
  parseMoneyInput,
  parsePlainNumberInput,
  pct,
  quoteSymbolForFund,
  quoteSymbolForTicker,
  signedMoney,
  signedRate,
  tickerEvaluation,
  todayString,
  totalInvestments,
  uid,
} from "./financeUtils";
import type { ShortKActuals, ShortKBudget, ShortKAssetAccountKey } from "./FinanceShared";
import {
  SHORT_K_ACCOUNTS,
  SHORT_M_ACCOUNTS,
  SHORT_K_ASSET_ACCOUNTS,
  SHORT_K_BASE_CASH,
  SHORT_K_BASE_MONTH,
  SHORT_K_BUDGET_FALLBACK_MONTH,
  SHORT_K_BUDGETS,
  SHORT_K_CHART_TAB_STORAGE_KEY,
  SHORT_K_END,
  SHORT_K_INITIAL_INVESTMENT_PROFIT,
  SHORT_K_MONTHLY_OPEN_YEARS_STORAGE_KEY,
  SHORT_K_START,
  BudgetActualSummary,
  BudgetVarianceCard,
  ConfirmDialog,
  FormattedNumberInput,
  MoneyInput,
  MonthInput,
  NumberInput,
  ShortKInputSection,
  MemoBudgetActualSummary,
  MemoBudgetActualRow,
  TextInput,
  actualAccount,
  blankMonthly,
  buildShortKNote,
  buildShortKPredictionSeries,
  canCalculateShortKDeposit,
  currentMonthString,
  displayMonth,
  getShortKAssetRows,
  hasShortKActuals,
  inMonthRange,
  investmentsByAccounts,
  isShortKEntered,
  latestByMonth,
  latestEnteredShortKMonth,
  latestInvestmentRows,
  monthlyForMonth,
  monthlyRows,
  monthsBetween,
  nextMonth,
  parseShortKActuals,
  readLocalStorage,
  parseShortKBudgetOverrides,
  predictedAccount,
  previousMonth,
  shortKAccountDepositForMonth,
  shortKAccountEvaluation,
  shortKAccountMonthlyRate,
  shortKAccountPredictedValue,
  shortKAccountPrincipal,
  shortKActualDelta,
  shortKAdjustedAssetSummary,
  shortKAssetAccountAliases,
  shortKAssetActualSummary,
  shortKAssetRowMatches,
  shortKAssetSummary,
  shortKBudget,
  shortKBudgetDelta,
  shortKBudgetIncomeTotal,
  shortKBudgetInvestmentTotal,
  shortKCalculatedDeposit,
  shortKIncomeTotal,
  shortKInvestmentIncomeCumulative,
  shortKInvestmentTotal,
  shortKMonthOptions,
  shortKOutgoTotal,
  shortKProjectedBalance,
  shortKTotalInvestmentProfit,
  shortKYearOptions,
  writeLocalStorage,
} from "./FinanceShared";

function AssetCompositionPie({
  rows,
  total,
  selectedId,
  onSelect,
}: {
  rows: { id: string; name: string; value: number }[];
  total: number;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const positiveRows = rows.filter((row) => row.value > 0);
  let current = 0;
  const radius = 44;
  const center = 50;

  const point = (ratio: number) => {
    const angle = ratio * Math.PI * 2 - Math.PI / 2;
    return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) };
  };

  return (
    <div className="flat-panel composition-panel">
      <div className="flat-panel-head compact-head">
        <div className="panel-title">構成銘柄</div>
        <span className="badge">合計 {money(total)}</span>
      </div>
      <div className="composition-body">
        {positiveRows.length === 0 ? (
          <div className="empty-state">評価額のある銘柄がありません。</div>
        ) : (
          <>
            <svg className="composition-pie" viewBox="0 0 100 100" role="img" aria-label="構成銘柄の評価額">
              {positiveRows.map((row, index) => {
                const start = current / total;
                current += row.value;
                const end = current / total;
                const startPoint = point(start);
                const endPoint = point(end);
                const largeArc = end - start > 0.5 ? 1 : 0;
                const selected = row.id === selectedId;
                return (
                  <path
                    key={row.id}
                    className={`composition-slice slice-${index % 8} ${selected ? "selected" : ""}`}
                    d={`M ${center} ${center} L ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${largeArc} 1 ${endPoint.x} ${endPoint.y} Z`}
                    onClick={() => onSelect(row.id)}
                  />
                );
              })}
              <circle cx={center} cy={center} r="24" className="composition-hole" />
            </svg>
            <div className="composition-legend">
              {positiveRows.map((row, index) => (
                <button
                  key={row.id}
                  type="button"
                  className={`composition-legend-row ${row.id === selectedId ? "active" : ""}`}
                  onClick={() => onSelect(row.id)}
                >
                  <span className={`legend-dot slice-${index % 8}`} />
                  <span>{row.name}</span>
                  <b>{money(row.value)}</b>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AssetHoldingDetailEditor({
  title,
  units,
  price,
  value,
  quoteSymbol,
  quoteLabel = "取得コード",
  quotePlaceholder = "取得コード",
  updatedAt,
  onUnitsChange,
  onQuoteSymbolChange,
  onRefresh,
}: {
  title: string;
  units: number;
  price: number;
  value: number;
  quoteSymbol?: string | null;
  quoteLabel?: string;
  quotePlaceholder?: string;
  updatedAt?: string | null;
  onUnitsChange: (value: number) => void;
  onQuoteSymbolChange?: (value: string) => void;
  onRefresh?: () => void;
}) {
  return (
    <div className="selected-asset-detail editable-selected-asset-detail">
      <div className="selected-asset-title">{title}</div>
      <div className="selected-asset-grid editable">
        <label className="selected-asset-edit-field">
          <span>保有数</span>
          <FormattedNumberInput value={units} onChange={onUnitsChange} />
        </label>
        {onQuoteSymbolChange ? (
          <label className="selected-asset-edit-field">
            <span>{quoteLabel}</span>
            <TextInput value={quoteSymbol ?? ""} onChange={onQuoteSymbolChange} placeholder={quotePlaceholder} />
          </label>
        ) : null}
        <div><span>基準価額</span><b>{formatCount(price)}</b></div>
        <div><span>評価額</span><b>{money(value)}</b></div>
      </div>
      <div className="asset-price-toolbar">
        {updatedAt ? <span className="asset-price-updated">最終更新 {updatedAt.slice(0, 10)}</span> : <span className="asset-price-updated">未更新</span>}
        {onRefresh ? <button type="button" className="btn" onClick={onRefresh}>基準価額を更新</button> : null}
      </div>
    </div>
  );
}

export function MomentumView({
  title,
  state,
  selectedFund,
  selectedTicker,
  selectedFundId,
  selectedTickerId,
  setSelectedFundId,
  setSelectedTickerId,
  updateFund,
  updateTicker,
  addFund,
  addTicker,
  deleteFund,
  deleteTicker,
}: {
  title?: string;
  state: FinanceState;
  selectedFund: FundRecord;
  selectedTicker: TickerHolding;
  selectedFundId: string;
  selectedTickerId: string;
  setSelectedFundId: (id: string) => void;
  setSelectedTickerId: (id: string) => void;
  updateFund: (row: FundRecord) => void;
  updateTicker: (row: TickerHolding) => void;
  addFund: (patch?: Partial<FundRecord>) => void;
  addTicker: (patch?: Partial<TickerHolding>) => void;
  deleteFund: (id: string) => void;
  deleteTicker: (id: string) => void;
}) {
  const isFund = title === "投資信託";
  const fundEvaluationTotal = useMemo(
    () => state.funds.reduce((sum, row) => sum + fundEvaluation(row), 0),
    [state.funds],
  );
  const tickerEvaluationTotal = useMemo(
    () => state.tickers.reduce((sum, row) => sum + tickerEvaluation(row), 0),
    [state.tickers],
  );
  const fetchedMarketKeysRef = useRef<Set<string>>(new Set());
  const [marketPriceStatus, setMarketPriceStatus] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const refreshFundPrice = useCallback(
    async (row: FundRecord, force = false) => {
      const symbol = quoteSymbolForFund(row);
      if (!symbol) {
        setMarketPriceStatus("投信コードを入力してください");
        return;
      }
      const key = `fund:${row.id}:${symbol}`;
      if (!force && fetchedMarketKeysRef.current.has(key)) return;
      fetchedMarketKeysRef.current.add(key);
      setMarketPriceStatus(`${symbol} の基準価額を確認中`);
      const price = await fetchLatestJapanFundPrice(symbol);
      if (!price) {
        setMarketPriceStatus(`${symbol} の基準価額を取得できませんでした`);
        return;
      }
      setMarketPriceStatus(`${symbol} の基準価額を更新しました`);
      updateFund({ ...row, price, last_price_updated_at: new Date().toISOString() });
    },
    [updateFund],
  );

  const refreshTickerPrice = useCallback(
    async (row: TickerHolding, force = false) => {
      const symbol = quoteSymbolForTicker(row);
      if (!symbol) return;
      const key = `ticker:${row.id}:${symbol}`;
      if (!force && fetchedMarketKeysRef.current.has(key)) return;
      fetchedMarketKeysRef.current.add(key);
      setMarketPriceStatus(`${symbol} の基準価額を確認中`);
      const price = await fetchLatestMarketPrice(symbol);
      if (!price) {
        setMarketPriceStatus(`${symbol} の基準価額を取得できませんでした`);
        return;
      }
      setMarketPriceStatus(`${symbol} の基準価額を更新しました`);
      if (Math.round(price * 10000) === Math.round(n(row.price) * 10000)) return;
      updateTicker({ ...row, price });
    },
    [updateTicker],
  );


  const refreshAllFundPrices = useCallback(async () => {
    if (!state.funds.length) return;
    setMarketPriceStatus("登録済み投資信託の基準価額を更新中");
    let updated = 0;
    let failed = 0;
    for (const row of state.funds) {
      const symbol = quoteSymbolForFund(row);
      if (!symbol) {
        failed += 1;
        continue;
      }
      const price = await fetchLatestJapanFundPrice(symbol);
      if (!price) {
        failed += 1;
        continue;
      }
      updated += 1;
      updateFund({ ...row, price, last_price_updated_at: new Date().toISOString() });
    }
    setMarketPriceStatus(`基準価額を${updated}件更新しました${failed ? `（未取得 ${failed}件）` : ""}`);
  }, [state.funds, updateFund]);

  useEffect(() => {
    if (!isFund) return;
    state.funds.forEach((row) => {
      void refreshFundPrice(row);
    });
  }, [isFund, state.funds, refreshFundPrice]);

  useEffect(() => {
    if (isFund) return;
    state.tickers.forEach((row) => {
      void refreshTickerPrice(row);
    });
  }, [isFund, state.tickers, refreshTickerPrice]);

  if (isFund) {
    return (
      <section className="stack asset-product-view">
        <AssetCompositionPie
          rows={state.funds.map((row) => ({
            id: row.id,
            name: row.name || "未設定",
            value: fundEvaluation(row),
          }))}
          total={fundEvaluationTotal}
          selectedId={selectedFundId}
          onSelect={setSelectedFundId}
        />

        {selectedFund ? (
          <AssetHoldingDetailEditor
            title={selectedFund.name || "未設定"}
            units={selectedFund.units}
            price={selectedFund.price}
            value={fundEvaluation(selectedFund)}
            quoteSymbol={selectedFund.quote_symbol}
            quoteLabel="投信コード"
            quotePlaceholder="例: 03313188"
            updatedAt={selectedFund.last_price_updated_at}
            onUnitsChange={(units) => updateFund({ ...selectedFund, units })}
            onQuoteSymbolChange={(quote_symbol) => updateFund({ ...selectedFund, quote_symbol })}
            onRefresh={() => void refreshFundPrice(selectedFund, true)}
          />
        ) : (
          <div className="empty-state">銘柄を追加してください。</div>
        )}

        <ProductAddDialog
          title="投資信託"
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          codeLabel="投信コード"
          codePlaceholder="例: 03313188"
          onSubmit={({ name, code, units, price }) => addFund({ name, quote_symbol: code, units, price })}
        />

        <div className="asset-price-actions">
          <button className="btn primary" type="button" onClick={() => void refreshAllFundPrices()}>登録済みの基準価額を一括更新</button>
        </div>
        {marketPriceStatus ? <div className="asset-price-status">{marketPriceStatus}</div> : null}
        <FundTable rows={state.funds} onSelect={setSelectedFundId} onDelete={deleteFund} onAdd={() => setAddDialogOpen(true)} onRefresh={(row) => void refreshFundPrice(row, true)} />
      </section>
    );
  }


  return (
    <section className="stack asset-product-view">
      <AssetCompositionPie
        rows={state.tickers.map((row) => ({
          id: row.id,
          name: row.ticker || "未設定",
          value: tickerEvaluation(row),
        }))}
        total={tickerEvaluationTotal}
        selectedId={selectedTickerId}
        onSelect={setSelectedTickerId}
      />

      {selectedTicker ? (
        <AssetHoldingDetailEditor
          title={selectedTicker.ticker || "未設定"}
          units={Math.max(1, n(selectedTicker.shares))}
          price={selectedTicker.price}
          value={tickerEvaluation(selectedTicker)}
          quoteSymbol={selectedTicker.ticker}
          quoteLabel="ティッカー"
          quotePlaceholder="例: NVDA / VOO / 1306.T"
          onUnitsChange={(shares) => updateTicker({ ...selectedTicker, shares: Math.max(1, shares) })}
          onQuoteSymbolChange={(ticker) => updateTicker({ ...selectedTicker, ticker: ticker.toUpperCase() })}
          onRefresh={() => void refreshTickerPrice(selectedTicker, true)}
        />
      ) : (
        <div className="empty-state">銘柄を追加してください。</div>
      )}

      <ProductAddDialog
        title="アクティブ"
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        codeLabel="ティッカー"
        codePlaceholder="例: NVDA / VOO / 1306.T"
        onSubmit={({ name, code, units, price }) => addTicker({ ticker: (code || name).toUpperCase(), shares: Math.max(1, units), price })}
      />

      <div className="asset-price-actions">
        <button className="btn primary" type="button" onClick={() => {
          state.tickers.forEach((row) => void refreshTickerPrice(row, true));
        }}>登録済みの基準価額を一括更新</button>
      </div>
      {marketPriceStatus ? <div className="asset-price-status">{marketPriceStatus}</div> : null}
      <TickerTable rows={state.tickers} onSelect={setSelectedTickerId} onDelete={deleteTicker} onAdd={() => setAddDialogOpen(true)} onRefresh={(row) => void refreshTickerPrice(row, true)} />
    </section>
  );
}


