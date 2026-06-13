"use client";

import { useMemo, useState } from "react";
import { ProductAddDialog } from "./FxView";
import type { FinanceState, FundRecord, TickerHolding } from "../../types/finance";
import { FundTable, TickerTable } from "./FinanceTables";
import {
  fetchLatestFundPrice,
  fetchLatestMarketPrice,
  fundEvaluation,
  money,
  n,
  quoteSymbolForFund,
  quoteSymbolForTicker,
  tickerEvaluation,
} from "./financeUtils";
import { FormattedNumberInput, TextInput } from "./FinanceShared";

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
  updatedAt,
  onUnitsChange,
  onQuoteSymbolChange,
}: {
  title: string;
  units: number;
  price: number;
  value: number;
  quoteSymbol?: string | null;
  updatedAt?: string | null;
  onUnitsChange: (value: number) => void;
  onQuoteSymbolChange?: (value: string) => void;
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
            <span>取得コード</span>
            <TextInput value={quoteSymbol ?? ""} onChange={onQuoteSymbolChange} placeholder="Yahoo Financeコード" />
          </label>
        ) : null}
        <div><span>価格</span><b>{price ? money(price) : "未取得"}</b></div>
        <div><span>評価額</span><b>{money(value)}</b></div>
      </div>
      <div className="asset-price-toolbar">
        {updatedAt ? <span className="asset-price-updated">最終更新 {updatedAt.slice(0, 10)}</span> : <span className="asset-price-updated">価格は更新ボタンで取得します</span>}
      </div>
    </div>
  );
}

function ProductRefreshHeader({ title, disabled, onRefresh }: { title: string; disabled: boolean; onRefresh: () => void }) {
  return (
    <div className="flat-panel-head compact-head">
      <div className="panel-title">{title}</div>
      <button className="btn" type="button" disabled={disabled} onClick={onRefresh}>更新</button>
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
  const fundEvaluationTotal = useMemo(() => state.funds.reduce((sum, row) => sum + fundEvaluation(row), 0), [state.funds]);
  const tickerEvaluationTotal = useMemo(() => state.tickers.reduce((sum, row) => sum + tickerEvaluation(row), 0), [state.tickers]);
  const [tickerUpdatedAtById, setTickerUpdatedAtById] = useState<Record<string, string>>({});
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [priceMessage, setPriceMessage] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const refreshFundPrice = async (row: FundRecord) => {
    const code = quoteSymbolForFund(row);
    if (!code) {
      setPriceMessage("取得コードを入力してください");
      return;
    }
    setRefreshingId(row.id);
    setPriceMessage("価格を取得しています");
    const price = await fetchLatestFundPrice(code);
    setRefreshingId(null);
    if (typeof price !== "number") {
      setPriceMessage("価格を取得できませんでした");
      return;
    }
    updateFund({ ...row, price, quote_symbol: row.quote_symbol || code, last_price_updated_at: new Date().toISOString() });
    setPriceMessage("価格を更新しました");
  };

  const refreshTickerPrice = async (row: TickerHolding) => {
    const symbol = quoteSymbolForTicker(row);
    if (!symbol) {
      setPriceMessage("ティッカーを入力してください");
      return;
    }
    setRefreshingId(row.id);
    setPriceMessage("価格を取得しています");
    const price = await fetchLatestMarketPrice(symbol);
    setRefreshingId(null);
    if (typeof price !== "number") {
      setPriceMessage("価格を取得できませんでした");
      return;
    }
    updateTicker({ ...row, price });
    setTickerUpdatedAtById((current) => ({ ...current, [row.id]: new Date().toISOString() }));
    setPriceMessage("価格を更新しました");
  };

  if (isFund) {
    return (
      <section className="stack asset-product-view">
        <ProductRefreshHeader title="投資信託" disabled={Boolean(refreshingId) || !selectedFund} onRefresh={() => selectedFund && void refreshFundPrice(selectedFund)} />
        {priceMessage && <div className="notice" role="status" aria-live="polite">{priceMessage}</div>}
        <AssetCompositionPie rows={state.funds.map((row) => ({ id: row.id, name: row.name || "未設定", value: fundEvaluation(row) }))} total={fundEvaluationTotal} selectedId={selectedFundId} onSelect={setSelectedFundId} />
        {selectedFund ? (
          <AssetHoldingDetailEditor title={selectedFund.name || "未設定"} units={selectedFund.units} price={selectedFund.price} value={fundEvaluation(selectedFund)} quoteSymbol={selectedFund.quote_symbol} updatedAt={selectedFund.last_price_updated_at} onUnitsChange={(units) => updateFund({ ...selectedFund, units })} onQuoteSymbolChange={(quote_symbol) => updateFund({ ...selectedFund, quote_symbol })} />
        ) : (
          <div className="empty-state">銘柄を追加してください。</div>
        )}
        <ProductAddDialog title="投資信託" open={addDialogOpen} onClose={() => setAddDialogOpen(false)} codeLabel="取得コード" codePlaceholder="例: 03311187 / 0331418A など" onSubmit={({ name, code, units, price }) => addFund({ name, quote_symbol: code, units, price })} />
        <FundTable rows={state.funds} onSelect={setSelectedFundId} onDelete={deleteFund} onAdd={() => setAddDialogOpen(true)} />
      </section>
    );
  }

  return (
    <section className="stack asset-product-view">
      <ProductRefreshHeader title="アクティブ" disabled={Boolean(refreshingId) || !selectedTicker} onRefresh={() => selectedTicker && void refreshTickerPrice(selectedTicker)} />
      {priceMessage && <div className="notice" role="status" aria-live="polite">{priceMessage}</div>}
      <AssetCompositionPie rows={state.tickers.map((row) => ({ id: row.id, name: row.ticker || "未設定", value: tickerEvaluation(row) }))} total={tickerEvaluationTotal} selectedId={selectedTickerId} onSelect={setSelectedTickerId} />
      {selectedTicker ? (
        <AssetHoldingDetailEditor title={selectedTicker.ticker || "未設定"} units={Math.max(1, n(selectedTicker.shares))} price={selectedTicker.price} value={tickerEvaluation(selectedTicker)} updatedAt={tickerUpdatedAtById[selectedTicker.id]} onUnitsChange={(shares) => updateTicker({ ...selectedTicker, shares: Math.max(1, shares) })} />
      ) : (
        <div className="empty-state">銘柄を追加してください。</div>
      )}
      <ProductAddDialog title="アクティブ" open={addDialogOpen} onClose={() => setAddDialogOpen(false)} onSubmit={({ name, units, price }) => addTicker({ ticker: name, shares: Math.max(1, units), price })} />
      <TickerTable rows={state.tickers} onSelect={setSelectedTickerId} onDelete={deleteTicker} onAdd={() => setAddDialogOpen(true)} />
    </section>
  );
}
