"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductAddDialog } from "./FxView";
import type { FinanceState, FundRecord, TickerHolding } from "../../types/finance";
import { FundTable } from "./FinanceTables";
import { fetchGooglePortfolio, type GooglePortfolioData } from "../../lib/googlePortfolio";
import {
  fundEvaluation,
  money,
} from "./financeUtils";
import { FormattedNumberInput, TextInput } from "./FinanceShared";

function usd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function usdWithJpy(value: number, usdJpy: number) {
  const yen = new Intl.NumberFormat("ja-JP", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value * usdJpy);
  return `${usd(value)} (${yen}円)`;
}

function AssetCompositionPie({
  rows,
  total,
  selectedId,
  onSelect,
  onRefresh,
  refreshDisabled,
  formatValue = money,
}: {
  rows: { id: string; name: string; value: number }[];
  total: number;
  selectedId: string;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  refreshDisabled: boolean;
  formatValue?: (value: number) => string;
}) {
  let current = 0;
  const positiveRows = rows.filter((row) => row.value > 0);
  const point = (ratio: number) => {
    const angle = ratio * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + 44 * Math.cos(angle), y: 50 + 44 * Math.sin(angle) };
  };
  return (
    <div className="flat-panel composition-panel">
      <div className="flat-panel-head compact-head">
        <div className="panel-title">構成銘柄</div>
        <button className="btn" type="button" disabled={refreshDisabled} onClick={onRefresh}>
          {refreshDisabled ? "更新中…" : "更新"}
        </button>
      </div>
      <div className="composition-body">
        {positiveRows.length ? (
          <svg className="composition-pie" viewBox="0 0 100 100" role="img" aria-label="構成銘柄">
            {positiveRows.map((row, index) => {
              const start = current / total;
              current += row.value;
              const end = current / total;
              const a = point(start);
              const b = point(end);
              return <path key={row.id} className={`composition-slice slice-${index % 8} ${row.id === selectedId ? "selected" : ""}`} d={`M 50 50 L ${a.x} ${a.y} A 44 44 0 ${end - start > 0.5 ? 1 : 0} 1 ${b.x} ${b.y} Z`} onClick={() => onSelect(row.id)} />;
            })}
            <circle cx="50" cy="50" r="24" className="composition-hole" />
          </svg>
        ) : <div className="empty-state">評価額はまだありません。</div>}
        <div className="composition-legend">
          {rows.map((row, index) => (
            <button key={row.id} type="button" className={`composition-legend-row ${row.id === selectedId ? "active" : ""}`} onClick={() => onSelect(row.id)}>
              <span className={`legend-dot slice-${index % 8}`} />
              <span>{row.name}</span>
              <b>{formatValue(row.value)}</b>
            </button>
          ))}
        </div>
        <div className="composition-total-row"><span>評価額合計</span><b>{formatValue(total)}</b></div>
      </div>
    </div>
  );
}

export function MomentumView({
  title,
  state,
  selectedFund,
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
  onRefreshInvestments,
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
  onRefreshInvestments: () => Promise<void>;
}) {
  const isFund = title === "投資信託";
  const [sheet, setSheet] = useState<GooglePortfolioData | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  async function loadSheet() {
    setLoading(true);
    setMessage("");
    try {
      const data = await fetchGooglePortfolio();
      setSheet(data);

      const portfolioTickers = new Set(data.rows.map((row) => row.ticker));
      state.tickers
        .filter((row) => row.ticker !== "CASH" && !portfolioTickers.has(row.ticker))
        .forEach((row) => deleteTicker(row.id));

      data.rows.forEach((row) => {
        const holding = state.tickers.find((item) => item.ticker === row.ticker);
        if (holding) {
          if (holding.price !== row.daily) updateTicker({ ...holding, price: row.daily });
        } else {
          addTicker({ ticker: row.ticker, price: row.daily, shares: 0 });
        }
      });

      if (!state.tickers.some((row) => row.ticker === "CASH")) {
        addTicker({ ticker: "CASH", price: 0, shares: 1 });
      }
    } catch (error) {
      setMessage(`スプレッドシートを取得できませんでした: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function refreshActiveInvestments() {
    setLoading(true);
    setMessage("");
    try {
      await onRefreshInvestments();
      setSheet(await fetchGooglePortfolio());
    } catch (error) {
      setMessage(`更新できませんでした: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isFund) void loadSheet();
  }, [isFund]);

  const compositionRows = useMemo(() => {
    const holdings = new Map(state.tickers.map((row) => [row.ticker, row]));
    const stockRows = (sheet?.rows ?? []).map((row) => {
      const holding = holdings.get(row.ticker);
      return {
        id: holding?.id ?? row.ticker,
        name: row.ticker,
        value: row.daily * (holding?.shares ?? 0),
      };
    });
    const cash = holdings.get("CASH");
    return [
      ...stockRows,
      { id: cash?.id ?? "CASH", name: "Cash", value: cash?.price ?? 0 },
    ];
  }, [sheet, state.tickers]);
  const compositionTotal = compositionRows.reduce((sum, row) => sum + row.value, 0);

  if (!isFund) {
    const selected = state.tickers.find((row) => row.id === selectedTickerId);
    const selectedValue = selected?.ticker === "CASH"
      ? selected.price
      : (selected?.price ?? 0) * (selected?.shares ?? 0);
    return (
      <section className="stack asset-product-view">
        {message && <div className="notice">{message}</div>}
        <div className="sheet-source-note">
          {sheet ? `${sheet.source === "cache" ? "前回取得分" : "Google スプレッドシート"}・10銘柄 + Cash` : "ポートフォリオを読み込み中"}
        </div>
        <AssetCompositionPie
          rows={compositionRows}
          total={compositionTotal}
          selectedId={selectedTickerId}
          onSelect={setSelectedTickerId}
          onRefresh={() => void refreshActiveInvestments()}
          refreshDisabled={loading}
          formatValue={(value) => usdWithJpy(value, sheet?.usdJpy ?? 0)}
        />
        {selected && (
          <div className="selected-asset-detail editable-selected-asset-detail compact-asset-detail">
            <div className="selected-asset-title">
              {selected.ticker === "CASH" ? "Cash" : selected.ticker}
            </div>
            <div className="selected-asset-grid editable compact-asset-grid">
              {selected.ticker === "CASH" ? (
                <label className="selected-asset-edit-field">
                  <span>Cash額</span>
                  <FormattedNumberInput
                    value={selected.price}
                    onChange={(price) => updateTicker({ ...selected, price, shares: 1 })}
                  />
                </label>
              ) : (
                <>
                  <label className="selected-asset-edit-field">
                    <span>保有株数</span>
                    <FormattedNumberInput
                      value={selected.shares}
                      onChange={(shares) => updateTicker({ ...selected, shares })}
                    />
                  </label>
                  <div><span>現在値</span><b>{usd(selected.price)}</b></div>
                </>
              )}
              <div><span>評価額</span><b>{usdWithJpy(selectedValue, sheet?.usdJpy ?? 0)}</b></div>
            </div>
          </div>
        )}
      </section>
    );
  }

  const fundTotal = state.funds.reduce((sum, row) => sum + fundEvaluation(row), 0);
  const selected = state.funds.find((row) => row.id === selectedFundId) ?? selectedFund;
  async function refreshFunds() {
    setLoading(true);
    setMessage("");
    try {
      await onRefreshInvestments();
    } catch (error) {
      setMessage(`更新できませんでした: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="stack asset-product-view">
      {message && <div className="notice">{message}</div>}
      <AssetCompositionPie
        rows={state.funds.map((row) => ({ id: row.id, name: row.name || "未設定", value: fundEvaluation(row) }))}
        total={fundTotal}
        selectedId={selectedFundId}
        onSelect={setSelectedFundId}
        onRefresh={() => void refreshFunds()}
        refreshDisabled={loading}
      />
      {selected && (
        <div className="selected-asset-detail editable-selected-asset-detail compact-asset-detail">
          <div className="selected-asset-title">{selected.name}</div>
          <div className="selected-asset-grid editable compact-asset-grid">
            <label className="selected-asset-edit-field"><span>保有数</span><FormattedNumberInput value={selected.units} onChange={(units) => updateFund({ ...selected, units })} /></label>
            <label className="selected-asset-edit-field"><span>取得コード</span><TextInput value={selected.quote_symbol ?? ""} onChange={(quote_symbol) => updateFund({ ...selected, quote_symbol })} /></label>
            <div><span>価格</span><b>{money(selected.price)}</b></div>
            <div><span>評価額</span><b>{money(fundEvaluation(selected))}</b></div>
          </div>
        </div>
      )}
      <ProductAddDialog title="投資信託" open={addDialogOpen} onClose={() => setAddDialogOpen(false)} codeLabel="取得コード" codePlaceholder="取得コード" onSubmit={({ name, code, units, price }) => addFund({ name, quote_symbol: code, units, price })} />
      <FundTable rows={state.funds} onSelect={setSelectedFundId} onDelete={deleteFund} onAdd={() => setAddDialogOpen(true)} />
    </section>
  );
}
