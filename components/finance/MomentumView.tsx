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
  usdMoney,
  usdPrice,
} from "./financeUtils";
import { FormattedNumberInput, TextInput } from "./FinanceShared";

const MOMENTUM_ACTUAL_SHARES_STORAGE_KEY = "finance.momentum.actualShares.v1";

function readMomentumActualShares() {
  if (typeof window === "undefined") return {} as Record<string, number>;
  try {
    const raw = window.localStorage.getItem(MOMENTUM_ACTUAL_SHARES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {} as Record<string, number>;
  }
}

function AssetCompositionPie({ rows, total, selectedId, onSelect, refreshDisabled, onRefresh, formatValue = money }: { rows: { id: string; name: string; value: number }[]; total: number; selectedId: string; onSelect: (id: string) => void; refreshDisabled: boolean; onRefresh: () => void; formatValue?: (value: number) => string }) {
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
                return <path key={row.id} className={`composition-slice slice-${index % 8} ${selected ? "selected" : ""}`} d={`M ${center} ${center} L ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${largeArc} 1 ${endPoint.x} ${endPoint.y} Z`} onClick={() => onSelect(row.id)} />;
              })}
              <circle cx={center} cy={center} r="24" className="composition-hole" />
            </svg>
            <div className="composition-legend">
              {positiveRows.map((row, index) => (
                <button key={row.id} type="button" className={`composition-legend-row ${row.id === selectedId ? "active" : ""}`} onClick={() => onSelect(row.id)}>
                  <span className={`legend-dot slice-${index % 8}`} />
                  <span>{row.name}</span>
                  <b>{formatValue(row.value)}</b>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ActiveTickerGrid({ rows }: { rows: TickerHolding[] }) {
  return (
    <div className="active-holding-grid">
      {rows.map((row) => (
        <div className="active-holding-card" key={row.id}>
          <b>{row.ticker || "未設定"}</b>
          <span>{usdMoney(tickerEvaluation(row))}</span>
          <small>{formatCount(n(row.shares))}株 / ${usdPrice(row.price)}</small>
        </div>
      ))}
    </div>
  );
}

function AssetHoldingDetailEditor({ title, units, price, value, quoteSymbol, updatedAt, onUnitsChange, onQuoteSymbolChange, formatValue = money, formatPrice = money }: { title: string; units: number; price: number; value: number; quoteSymbol?: string | null; updatedAt?: string | null; onUnitsChange: (value: number) => void; onQuoteSymbolChange?: (value: string) => void; formatValue?: (value: number) => string; formatPrice?: (value: number) => string }) {
  return (
    <div className="selected-asset-detail editable-selected-asset-detail">
      <div className="selected-asset-title">{title}</div>
      <div className="selected-asset-grid editable">
        <label className="selected-asset-edit-field"><span>保有数</span><FormattedNumberInput value={units} onChange={onUnitsChange} /></label>
        {onQuoteSymbolChange ? <label className="selected-asset-edit-field"><span>取得コード</span><TextInput value={quoteSymbol ?? ""} onChange={onQuoteSymbolChange} placeholder="Yahoo Financeコード" /></label> : null}
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

  useEffect(() => {
    setMomentumActualShares(readMomentumActualShares());
  }, [isFund]);

  const displayedFunds = useMemo(() => state.funds.map((row) => ({ ...row, price: fundPriceById[row.id] ?? row.price })), [fundPriceById, state.funds]);
  const displayedTickers = useMemo(
    () =>
      state.tickers.map((row) => {
        const key = row.ticker.trim().toUpperCase();
        return {
          ...row,
          shares: momentumActualShares[key] ?? 0,
          price: tickerPriceById[row.id] ?? row.price,
        };
      }),
    [momentumActualShares, state.tickers, tickerPriceById],
  );
  const displayedSelectedFund = displayedFunds.find((row) => row.id === selectedFundId) ?? displayedFunds[0] ?? selectedFund;
  const fundEvaluationTotal = useMemo(() => displayedFunds.reduce((sum, row) => sum + fundEvaluation(row), 0), [displayedFunds]);
  const tickerEvaluationTotal = useMemo(() => displayedTickers.reduce((sum, row) => sum + tickerEvaluation(row), 0), [displayedTickers]);

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
      <AssetCompositionPie rows={displayedTickers.map((row) => ({ id: row.id, name: row.ticker || "未設定", value: tickerEvaluation(row) }))} total={tickerEvaluationTotal} selectedId={selectedTickerId} onSelect={setSelectedTickerId} refreshDisabled={Boolean(refreshingId) || displayedTickers.length === 0} onRefresh={() => void refreshTickerPrice()} formatValue={usdMoney} />
      <ActiveTickerGrid rows={displayedTickers} />
    </section>
  );
}
