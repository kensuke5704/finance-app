"use client";

import { useEffect, useMemo, useState } from "react";
import type { FundRecord, FxTrade, InvestmentRecord, TickerHolding } from "../../types/finance";
import {
  formatCount,
  fundEvaluation,
  investmentValue,
  money,
  n,
  pct,
  signedMoney,
  tickerEvaluation,
  totalInvestments,
} from "./financeUtils";

export function AssetCards({ rows }: { rows: InvestmentRecord[] }) {
  return (
    <div className="asset-cards">
      {rows.map((row) => (
        <div className="asset-card" key={row.id}>
          <div className="asset-name">{row.account}</div>
          <div className="asset-value">{money(investmentValue(row))}</div>
          <div className="muted">元本 {money(row.capital)}</div>
        </div>
      ))}
    </div>
  );
}

export function InvestmentSummary({ rows }: { rows: InvestmentRecord[] }) {
  return (
    <>
      <AssetCards rows={rows} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>口座</th>
              <th className="num">元本</th>
              <th className="num">予想</th>
              <th className="num">実績</th>
              <th className="num">損益</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.account}</td>
                <td className="num">{money(row.capital)}</td>
                <td className="num">{money(row.predicted_balance)}</td>
                <td className="num">{money(row.actual_balance)}</td>
                <td
                  className={`num ${investmentValue(row) - row.capital < 0 ? "negative" : "positive"}`}
                >
                  {money(investmentValue(row) - row.capital)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function AllocationPanel({ rows }: { rows: InvestmentRecord[] }) {
  const total = Math.max(totalInvestments(rows), 1);
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">資産配分</div>
        <span className="badge">割合</span>
      </div>
      <div className="panel-body">
        <div className="allocation-list">
          {rows.map((row) => {
            const value = investmentValue(row);
            return (
              <div className="allocation-row" key={row.id}>
                <div className="allocation-top">
                  <span>{row.account}</span>
                  <b>{pct.format(value / total)}</b>
                </div>
                <div className="allocation-track">
                  <div
                    className="allocation-fill"
                    style={{ width: `${(value / total) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function buildInvestmentMonthlySeries(rows: InvestmentRecord[]) {
  const monthMap = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.month] = (acc[row.month] ?? 0) + investmentValue(row);
    return acc;
  }, {});
  return Object.entries(monthMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value }));
}

export function buildInvestmentAccountSeries(
  rows: InvestmentRecord[],
  accounts: string[],
) {
  const months = Array.from(new Set(rows.map((row) => row.month))).sort(
    (a, b) => a.localeCompare(b),
  );
  return months.map((month) => {
    const item: Record<string, string | number> = { label: month };
    accounts.forEach((account) => {
      const row = rows.find(
        (entry) => entry.month === month && entry.account === account,
      );
      item[account] = row ? investmentValue(row) : 0;
    });
    return item;
  });
}

export function LongPlanTable({
  rows,
  onSelect,
  onDelete,
  badge,
}: {
  rows: InvestmentRecord[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  badge: string;
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">{badge} 一覧</div>
        <span className="badge">そのまま集計</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>月</th>
              <th>シート</th>
              <th className="num">入金</th>
              <th className="num">出金</th>
              <th className="num">元本</th>
              <th className="num">予測残高</th>
              <th className="num">実績残高</th>
              <th className="num">差額</th>
              <th>メモ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[...rows]
              .sort((a, b) => b.month.localeCompare(a.month))
              .map((row) => {
                const value = investmentValue(row);
                return (
                  <tr key={row.id}>
                    <td>
                      <button className="btn" onClick={() => onSelect(row.id)}>
                        {row.month}
                      </button>
                    </td>
                    <td>{row.account}</td>
                    <td className="num">{money(row.deposit)}</td>
                    <td className="num">{money(row.withdrawal)}</td>
                    <td className="num">{money(row.capital)}</td>
                    <td className="num">{money(row.predicted_balance)}</td>
                    <td className="num">{money(row.actual_balance)}</td>
                    <td
                      className={`num ${value - row.capital < 0 ? "negative" : "positive"}`}
                    >
                      {money(value - row.capital)}
                    </td>
                    <td>{row.note}</td>
                    <td>
                      <button
                        className="btn danger"
                        onClick={() => onDelete(row.id)}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function InvestmentTable({
  rows,
  onSelect,
  onDelete,
}: {
  rows: InvestmentRecord[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">積立一覧</div>
        <span className="badge">M23-30inv</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>月</th>
              <th>項目</th>
              <th className="num">入金</th>
              <th className="num">出金</th>
              <th className="num">元本</th>
              <th className="num">現在額</th>
              <th className="num">損益</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[...rows]
              .sort((a, b) => b.month.localeCompare(a.month))
              .map((row) => (
                <tr key={row.id}>
                  <td>
                    <button className="btn" onClick={() => onSelect(row.id)}>
                      {row.month}
                    </button>
                  </td>
                  <td>{row.account}</td>
                  <td className="num">{money(row.deposit)}</td>
                  <td className="num">{money(row.withdrawal)}</td>
                  <td className="num">{money(row.capital)}</td>
                  <td className="num">{money(investmentValue(row))}</td>
                  <td
                    className={`num ${investmentValue(row) - row.capital < 0 ? "negative" : "positive"}`}
                  >
                    {money(investmentValue(row) - row.capital)}
                  </td>
                  <td>
                    <button
                      className="btn danger"
                      onClick={() => onDelete(row.id)}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FundTable({
  rows,
  onSelect,
  onDelete,
  onAdd,
}: {
  rows: FundRecord[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flat-panel asset-product-list">
      <div className="flat-panel-head compact-head">
        <div className="panel-title">保有商品</div>
        <button className="btn primary compact-add-btn" type="button" onClick={onAdd}>追加</button>
      </div>
      <div className="asset-product-list-body">
        {rows.length === 0 ? (
          <div className="empty-state">商品がありません。</div>
        ) : (
          rows.map((row) => (
            <div className="asset-product-row" key={row.id}>
              <button className="asset-product-main" type="button" onClick={() => onSelect(row.id)}>
                <span className="asset-product-name">{row.name || "未設定"}</span>
                <span className="asset-product-value">{money(fundEvaluation(row))}</span>
              </button>
              <div className="asset-product-meta">
                <span>保有数 {formatCount(row.units)}</span>
                <span>基準価額 {formatCount(row.price)}</span>
              </div>
              <button className="btn danger" type="button" onClick={() => onDelete(row.id)}>削除</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function TickerTable({
  rows,
  onSelect,
  onDelete,
  onAdd,
}: {
  rows: TickerHolding[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flat-panel asset-product-list">
      <div className="flat-panel-head compact-head">
        <div className="panel-title">保有商品</div>
        <button className="btn primary compact-add-btn" type="button" onClick={onAdd}>追加</button>
      </div>
      <div className="asset-product-list-body">
        {rows.length === 0 ? (
          <div className="empty-state">商品がありません。</div>
        ) : (
          rows.map((row) => (
            <div className="asset-product-row" key={row.id}>
              <button className="asset-product-main" type="button" onClick={() => onSelect(row.id)}>
                <span className="asset-product-name">{row.ticker || "未設定"}</span>
                <span className="asset-product-value">{money(tickerEvaluation(row))}</span>
              </button>
              <div className="asset-product-meta">
                <span>保有数 {formatCount(Math.max(1, n(row.shares)))}</span>
                <span>基準価額 {formatCount(row.price)}</span>
              </div>
              <button className="btn danger" type="button" onClick={() => onDelete(row.id)}>削除</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function FxTable({
  rows,
  onSelect,
  onDelete,
}: {
  rows: FxTrade[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => b.date.localeCompare(a.date)),
    [rows],
  );
  const groups = useMemo(() => {
    const map = new Map<string, FxTrade[]>();
    sortedRows.forEach((row) => {
      const month = row.date.slice(0, 7) || "未設定";
      const current = map.get(month) ?? [];
      current.push(row);
      map.set(month, current);
    });
    return Array.from(map.entries()).map(([month, items]) => ({
      month,
      items,
      total: items.reduce((sum, row) => sum + n(row.result), 0),
    }));
  }, [sortedRows]);
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("finance.fx.openMonths");
      if (stored) setOpenMonths(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("finance.fx.openMonths", JSON.stringify(openMonths));
    } catch {}
  }, [openMonths]);


  const toggleMonth = (month: string) => {
    setOpenMonths((current) => ({ ...current, [month]: !current[month] }));
  };

  return (
    <div className="flat-panel fx-history-panel">
      <div className="flat-panel-head">
        <div className="panel-title">履歴</div>
      </div>
      <div className="fx-history-list">
        {groups.length === 0 ? (
          <div className="empty-state">履歴がありません。</div>
        ) : (
          groups.map((group) => {
            const open = openMonths[group.month] ?? false;
            return (
              <div className="fx-month-group" key={group.month}>
                <button className="fx-month-head" type="button" onClick={() => toggleMonth(group.month)}>
                  <span>{open ? "▼" : "▶"} {group.month}</span>
                  <b className={group.total < 0 ? "negative" : "positive"}>{signedMoney(group.total)}</b>
                </button>
                {open && (
                  <div className="fx-month-body">
                    {group.items.map((row) => (
                      <div className="fx-history-row" key={row.id}>
                        <button className="fx-history-main" type="button" onClick={() => onSelect(row.id)}>
                          <span>{row.date}</span>
                          <b className={row.result < 0 ? "negative" : "positive"}>{signedMoney(row.result)}</b>
                        </button>
                        <button className="btn danger" type="button" onClick={() => onDelete(row.id)}>削除</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
