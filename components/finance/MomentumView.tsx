"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductAddDialog } from "./FxView";
import type { FinanceState, FundRecord, TickerHolding } from "../../types/finance";
import { FundTable } from "./FinanceTables";
import {
  fetchLatestFundPrice,
  fetchLatestMarketPrice,
  formatCount,
  fundEvaluation,
  money,
  n,
  quoteSymbolForFund,
  quoteSymbolForTicker,
  tickerEvaluation,
  usdPrice,
} from "./financeUtils";
import { FormattedNumberInput, TextInput } from "./FinanceShared";

const MOMENTUM_ACTUAL_SHARES_STORAGE_KEY = "finance.momentum.actualShares.v1";
const ACTIVE_CASH_STORAGE_KEY = "finance.active.cash.v1";
const ACTIVE_USDJPY_STORAGE_KEY = "finance.active.usdJpy.v1";
const CASH_ROW_ID = "__cash__";
const FALLBACK_USD_JPY = 160.185;

function readJsonObject(key: string) {
  if (typeof window === "undefined") return {} as Record<string, number>;
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {} as Record<string, number>;
  }
}

function readNumber(key: string, fallback = 0) {
  if (typeof window === "undefined") return fallback;
  const parsed = Number(window.localStorage.getItem(key));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function yenFromUsd(value: number, usdJpy: number) {
  return value * (usdJpy || FALLBACK_USD_JPY);
}

function AssetCompositionPie({
  rows,
  total,
  selectedId,
  onSelect,
  refreshDisabled,
  onRefresh,
  formatValue = money,
}: {
  rows: { id: string; name: string; value: number }[];
  total: number;
  selectedId: string;
  onSelect: (id: string) => void;
  refreshDisabled: boolean;
  onRefresh: () => void;
  formatValue?: (value: number) => string;
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
        <button className="btn" type="button" disabled={refreshDisabled} onClick={onRefresh}>更新</button>
      </div>
      <div className="composition-body">
        {rows.length === 0 ? (
          <div className="empty-state">銘柄がありません。</div>
        ) : (
          <>
            {positiveRows.length > 0 ? (
              <svg className="composition-pie" viewBox="0 0 100 100" role="img" aria-label="構成銘柄の評価額">
                {positiveRows.map((row, index) => {
                  const start = current / total;
                  current += row.value;
                  const end = current / total;
                  const startPoint = point(start);
                  const endPoint = point(end);
                  const largeArc = end - start > 0.5 ? 1 : 0;
                  const selected = row.id === selectedId;
                  return <path key={row.id} className={`composition-slice slice-${index % 8} ${selected ? "selected" : ""}`} d={`M ${center} ${center} L ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${largeArc} 1 ${endPoint.x} ${endPoint.y} Z`} onClick={() => onSelect(row.id)} />;
                })}
                <circle cx={center} cy={center} r="24" className="composition-hole" />
              </svg>
            ) : (
              <div className="empty-state">評価額はまだありません。</div>
            )}
            <div className="composition-legend">
              {rows.map((row, index) => (
                <button key={row.id} type="button" className={`composition-legend-row ${row.id === selectedId ? "active" : ""} ${row.value <= 0 ? "zero" : ""}`} onClick={() => onSelect(row.id)}>
                  <span className={`legend-dot slice-${index % 8}`} />
                  <span>{row.name}</span>
                  <b>{formatValue(row.value)}</b>
                </button>
              ))}
            </div>
            <div className="composition-total-row">
              <span>評価額合計</span>
              <b>{formatValue(total)}</b>
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
  updatedAt,
  onUnitsChange,
  onQuoteSymbolChange,
  formatValue = money,
  formatPrice = money,
}: {
  title: string;
  units: number;
  price: number;
  value: number;
  quoteSymbol?: string | null;
  updatedAt?: string | null;
  onUnitsChange: (value: number) => void;
  onQuoteSymbolChange?: (value: string) => void;
  formatValue?: (value: number) => string;
  formatPrice?: (value: number) => string;
}) {
  return (
    <div className="selected-asset-detail editable-selected-asset-detail compact-asset-detail">
      <div className="selected-asset-title">{title}</div>
      <div className="selected-asset-grid editable compact-asset-grid">
        <label className="selected-asset-edit-field"><span>保有数</span><FormattedNumberInput value={units} onChange={onUnitsChange} /></label>
        {onQuoteSymbolChange ? <label className="selected-asset-edit-field"><span>取得コード</span><TextInput value={quoteSymbol ?? ""} onChange={onQuoteSymbolChange} placeholder="取得コード" /></label> : null}
        <div><span>価格</span><b>{price ? formatPrice(price) : "未取得"}</b></div>
        <div><span>評価額</span><b>{formatValue(value)}</b></div>
      </div>
      <div className="asset-price-toolbar">
        {updatedAt ? <span className="asset-price-updated">最終更新 {updatedAt.slice(0, 10)}</span> : <span className="asset-price-updated">価格は更新ボタンで取得します</span>}
      </div>
    </div>
  );
}

async function withUiTimeout(task: Promise<number | null>) {
  return Promise.race([task, new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 15000))]);
}

export function MomentumView({ title, state, selectedFund, selectedTicker, selectedFundId, selectedTickerId, setSelectedFundId, setSelectedTickerId, updateFund, updateTicker, addFund, deleteFund }: { title?: string; state: FinanceState; selectedFund: FundRecord; selectedTicker: TickerHolding; selectedFundId: string; selectedTickerId: string; setSelectedFundId: (id: string) => void; setSelectedTickerId: (id: string) => void; updateFund: (row: FundRecord) => void; updateTicker: (row: TickerHolding) => void; addFund: (patch?: Partial<FundRecord>) => void; addTicker: (patch?: Partial<TickerHolding>) => void; deleteFund: (id: string) => void; deleteTicker: (id: string) => void }) {
  const isFund = title === "投資信託";
  const [fundPriceById, setFundPriceById] = useState<Record<string, number>>({});
  const [tickerPriceById, setTickerPriceById] = useState<Record<string, number>>({});
  const [fundUpdatedAtById, setFundUpdatedAtById] = useState<Record<string, string>>({});
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [priceMessage, setPriceMessage] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [momentumActualShares, setMomentumActualShares] = useState<Record<string, number>>({});
  const [activeCash, setActiveCash] = useState(0);
  const [usdJpyRate, setUsdJpyRate] = useState(FALLBACK_USD_JPY);

  useEffect(() => {
    setMomentumActualShares(readJsonObject(MOMENTUM_ACTUAL_SHARES_STORAGE_KEY));
    setActiveCash(readNumber(ACTIVE_CASH_STORAGE_KEY, 0));
    setUsdJpyRate(readNumber(ACTIVE_USDJPY_STORAGE_KEY, FALLBACK_USD_JPY));
  }, [isFund]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    void fetchLatestMarketPrice("USDJPY").then((rate) => {
      if (typeof rate !== "number") return;
      setUsdJpyRate(rate);
      window.localStorage.setItem(ACTIVE_USDJPY_STORAGE_KEY, String(rate));
    });
  }, []);

  const displayedFunds = useMemo(() => state.funds.map((row) => ({ ...row, price: fundPriceById[row.id] ?? row.price })), [fundPriceById, state.funds]);
  const displayedTickers = useMemo(
    () => state.tickers.map((row) => {
      const key = row.ticker.trim().toUpperCase();
      return { ...row, shares: momentumActualShares[key] ?? 0, price: tickerPriceById[row.id] ?? row.price };
    }),
    [momentumActualShares, state.tickers, tickerPriceById],
  );
  const displayedSelectedFund = displayedFunds.find((row) => row.id === selectedFundId) ?? displayedFunds[0] ?? selectedFund;
  const fundEvaluationTotal = useMemo(() => displayedFunds.reduce((sum, row) => sum + fundEvaluation(row), 0), [displayedFunds]);
  const activeCompositionRows = useMemo(
    () => [
      ...displayedTickers.map((row) => ({ id: row.id, name: row.ticker || "未設定", value: yenFromUsd(tickerEvaluation(row), usdJpyRate) })),
      { id: CASH_ROW_ID, name: "Cash", value: activeCash },
    ],
    [activeCash, displayedTickers, usdJpyRate],
  );
  const activeEvaluationTotal = useMemo(() => activeCompositionRows.reduce((sum, row) => sum + row.value, 0), [activeCompositionRows]);

  const refreshFundPrice = async () => {
    setRefreshingId("funds");
    setPriceMessage("価格を取得しています");
    let count = 0;
    try {
      for (const row of displayedFunds) {
        const code = quoteSymbolForFund(row);
        const price = code ? await withUiTimeout(fetchLatestFundPrice(code)) : null;
        if (typeof price !== "number") continue;
        const updatedAt = new Date().toISOString();
        setFundPriceById((current) => ({ ...current, [row.id]: price }));
        setFundUpdatedAtById((current) => ({ ...current, [row.id]: updatedAt }));
        updateFund({ ...row, price, quote_symbol: row.quote_symbol || code, last_price_updated_at: updatedAt });
        count += 1;
      }
      setPriceMessage(count ? `価格を更新しました: ${count}件` : "価格を取得できませんでした");
    } catch {
      setPriceMessage("価格を取得できませんでした");
    } finally {
      setRefreshingId(null);
    }
  };

  const refreshTickerPrice = async () => {
    setRefreshingId("tickers");
    setPriceMessage("価格を取得しています");
    let count = 0;
    try {
      const rate = await withUiTimeout(fetchLatestMarketPrice("USDJPY"));
      if (typeof rate === "number") {
        setUsdJpyRate(rate);
        window.localStorage.setItem(ACTIVE_USDJPY_STORAGE_KEY, String(rate));
      }
      for (const row of displayedTickers) {
        const symbol = quoteSymbolForTicker(row);
        const price = symbol ? await withUiTimeout(fetchLatestMarketPrice(symbol)) : null;
        if (typeof price !== "number") continue;
        setTickerPriceById((current) => ({ ...current, [row.id]: price }));
        updateTicker({ ...row, price });
        count += 1;
      }
      setPriceMessage(count ? `価格を更新しました: ${count}件` : "価格を取得できませんでした");
    } catch {
      setPriceMessage("価格を取得できませんでした");
    } finally {
      setRefreshingId(null);
    }
  };

  const handleActiveSelect = (id: string) => {
    if (id !== CASH_ROW_ID) {
      setSelectedTickerId(id);
      return;
    }
    const raw = window.prompt("Cashの金額を入力してください", activeCash ? String(Math.round(activeCash)) : "");
    if (raw === null) return;
    const nextCash = Number(raw.replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(nextCash)) return;
    setActiveCash(nextCash);
    window.localStorage.setItem(ACTIVE_CASH_STORAGE_KEY, String(nextCash));
  };

  if (isFund) {
    return (
      <section className="stack asset-product-view">
        {priceMessage && <div className="notice" role="status" aria-live="polite">{priceMessage}</div>}
        <AssetCompositionPie rows={displayedFunds.map((row) => ({ id: row.id, name: row.name || "未設定", value: fundEvaluation(row) }))} total={fundEvaluationTotal} selectedId={selectedFundId} onSelect={setSelectedFundId} refreshDisabled={Boolean(refreshingId) || displayedFunds.length === 0} onRefresh={() => void refreshFundPrice()} />
        {displayedSelectedFund ? <AssetHoldingDetailEditor title={displayedSelectedFund.name || "未設定"} units={displayedSelectedFund.units} price={displayedSelectedFund.price} value={fundEvaluation(displayedSelectedFund)} quoteSymbol={displayedSelectedFund.quote_symbol} updatedAt={fundUpdatedAtById[displayedSelectedFund.id] ?? displayedSelectedFund.last_price_updated_at} onUnitsChange={(units) => updateFund({ ...displayedSelectedFund, units })} onQuoteSymbolChange={(quote_symbol) => updateFund({ ...displayedSelectedFund, quote_symbol })} /> : <div className="empty-state">銘柄を追加してください。</div>}
        <ProductAddDialog title="投資信託" open={addDialogOpen} onClose={() => setAddDialogOpen(false)} codeLabel="取得コード" codePlaceholder="例: 03311187 / 0331418A など" onSubmit={({ name, code, units, price }) => addFund({ name, quote_symbol: code, units, price })} />
        <FundTable rows={displayedFunds} onSelect={setSelectedFundId} onDelete={deleteFund} onAdd={() => setAddDialogOpen(true)} />
      </section>
    );
  }

  return (
    <section className="stack asset-product-view">
      {priceMessage && <div className="notice" role="status" aria-live="polite">{priceMessage}</div>}
      <AssetCompositionPie rows={activeCompositionRows} total={activeEvaluationTotal} selectedId={selectedTickerId} onSelect={handleActiveSelect} refreshDisabled={Boolean(refreshingId) || displayedTickers.length === 0} onRefresh={() => void refreshTickerPrice()} formatValue={money} />
      <div className="active-rate-note">USD/JPY {usdPrice(usdJpyRate)}</div>
    </section>
  );
}
