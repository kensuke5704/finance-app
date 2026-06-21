"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FxRiskInput, FxTrade } from "../../types/finance";
import { MultiLineChart } from "./FinanceCharts";
import { FormattedNumberInput, MoneyInput, TextInput } from "./FinanceInputs";
import { FxTable } from "./FinanceTables";
import { money, signedMoney, todayString } from "./financeUtils";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const USD_PER_LOT = 10_000;
const MAX_LEVERAGE = 25;

type FxMarketData = {
  symbol: string;
  pair: string;
  source: string;
  updatedAt: string;
  latest: number;
  rows: { date: string; close: number }[];
};

function addDays(dateString: string, diff: number) {
  const base = dateString ? new Date(`${dateString}T00:00:00`) : new Date();
  base.setDate(base.getDate() + diff);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}

function daysInMonth(year: string, month: string) {
  const y = Number(year);
  const m = Number(month);
  if (!y || !m) return 31;
  return new Date(y, m, 0).getDate();
}

function yearOptionsForFx() {
  const current = new Date().getFullYear();
  return Array.from({ length: 11 }, (_, index) => String(current - 5 + index));
}

function dayDiff(from: string, to: string) {
  const fromTime = new Date(`${from}T00:00:00Z`).getTime();
  const toTime = new Date(`${to}T00:00:00Z`).getTime();
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) return 0;
  return Math.max(0, Math.floor((toTime - fromTime) / 86_400_000));
}

function rate(value: number) {
  return Number.isFinite(value) ? value.toFixed(3) : "—";
}

function ratio(value: number) {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : "—";
}

export function ProductAddDialog({
  title,
  open,
  onClose,
  onSubmit,
  codeLabel,
  codePlaceholder,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  onSubmit: (values: { name: string; code: string; units: number; price: number }) => void;
  codeLabel?: string;
  codePlaceholder?: string;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [units, setUnits] = useState(1);
  const [price, setPrice] = useState(0);

  useEffect(() => {
    if (!open) return;
    setName("");
    setCode("");
    setUnits(1);
    setPrice(0);
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card product-add-modal">
        <div className="modal-title">{title}を追加</div>
        <div className="product-add-form">
          <label className="field">
            <span className="label">商品名</span>
            <TextInput value={name} onChange={setName} placeholder="商品名・コード" />
          </label>
          {codeLabel ? (
            <label className="field">
              <span className="label">{codeLabel}</span>
              <TextInput value={code} onChange={setCode} placeholder={codePlaceholder ?? "取得コード"} />
            </label>
          ) : null}
          <label className="field">
            <span className="label">保有数</span>
            <FormattedNumberInput value={units} onChange={setUnits} />
          </label>
          <label className="field">
            <span className="label">基準価額</span>
            <FormattedNumberInput value={price} onChange={setPrice} />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>キャンセル</button>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              onSubmit({
                name: name.trim(),
                code: code.trim(),
                units: Math.max(0, units),
                price,
              });
              onClose();
            }}
          >
            追加
          </button>
        </div>
      </div>
    </div>
  );
}

export function FxView({
  rows,
  setSelectedFxId,
  addFx,
  deleteFx,
  risk,
  updateRisk,
}: {
  rows: FxTrade[];
  selectedFx: FxTrade;
  selectedFxId: string;
  setSelectedFxId: (id: string) => void;
  updateFx: (row: FxTrade) => void;
  addFx: (patch?: Partial<FxTrade>) => void;
  deleteFx: (id: string) => void;
  risk: FxRiskInput;
  updateRisk: (row: FxRiskInput) => void;
  floatingLoss: number;
  requiredMargin: number;
  shortage: number;
  losscutRate: number;
}) {
  const [recordDate, setRecordDate] = useState(todayString());
  const [recordResult, setRecordResult] = useState(0);
  const [marketData, setMarketData] = useState<FxMarketData | null>(null);
  const [marketStatus, setMarketStatus] = useState<"loading" | "ready" | "error">("loading");

  const loadMarketData = useCallback(async () => {
    setMarketStatus("loading");
    try {
      const response = await fetch(
        `${basePath}/usdjpy-history.json?ts=${Date.now()}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(`market data ${response.status}`);
      const payload = (await response.json()) as FxMarketData;
      if (!Number.isFinite(payload.latest) || !Array.isArray(payload.rows)) {
        throw new Error("invalid market data");
      }
      setMarketData(payload);
      setMarketStatus("ready");
    } catch {
      setMarketStatus("error");
    }
  }, []);

  useEffect(() => {
    loadMarketData();
  }, [loadMarketData]);

  useEffect(() => {
    const id = window.setInterval(() => setRecordDate(todayString()), 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  const entryDate = risk.entry_date || todayString();
  const positionSide = risk.position_side ?? "buy";
  const positionSign = positionSide === "buy" ? 1 : -1;
  const lots = risk.units / USD_PER_LOT;
  const units = Math.max(risk.units, 0);
  const currentRate = marketData?.latest ?? risk.current_rate;
  const holdingDays = dayDiff(entryDate, todayString());
  const cumulativeSwap = risk.swap_per_unit * lots * holdingDays;
  const priceProfit =
    positionSign * (currentRate - risk.contract_rate) * units;
  const unrealizedProfit = priceProfit + cumulativeSwap;
  const totalMargin = risk.margin + risk.extra_margin;
  const requiredMargin = (currentRate * units) / MAX_LEVERAGE;
  const netAsset = totalMargin + unrealizedProfit;
  const maintenanceRatio = requiredMargin > 0 ? (netAsset / requiredMargin) * 100 : 0;
  const shortage = Math.max(requiredMargin - netAsset, 0);
  const maintenanceRate =
    units > 0
      ? (totalMargin +
          cumulativeSwap -
          positionSign * risk.contract_rate * units) /
        (units * (1 / MAX_LEVERAGE - positionSign))
      : 0;

  const historicalRows = useMemo(() => {
    const sourceRows = marketData?.rows ?? [];
    const filtered = sourceRows.filter((row) => row.date >= entryDate);
    const today = todayString();
    const withLatest = [...filtered];
    if (marketData && currentRate > 0) {
      const last = withLatest.at(-1);
      if (last?.date === today) {
        withLatest[withLatest.length - 1] = { date: today, close: currentRate };
      } else if (!last || last.date < today) {
        withLatest.push({ date: today, close: currentRate });
      }
    }
    return withLatest.map((row) => {
      const elapsedDays = dayDiff(entryDate, row.date);
      const swap = risk.swap_per_unit * lots * elapsedDays;
      return {
        label: row.date,
        profit:
          positionSign * (row.close - risk.contract_rate) * units + swap,
        close: row.close,
        maintenanceRate,
      };
    });
  }, [
    currentRate,
    entryDate,
    lots,
    maintenanceRate,
    marketData,
    positionSign,
    risk.contract_rate,
    risk.swap_per_unit,
    units,
  ]);

  const updateRiskField = <K extends keyof FxRiskInput>(key: K, value: FxRiskInput[K]) => {
    updateRisk({ ...risk, [key]: value });
  };

  const recordFxResult = () => {
    addFx({ date: recordDate || todayString(), result: recordResult, memo: null });
    setRecordResult(0);
  };

  return (
    <section className="stack fx-asset-view fx-position-page">
      <div className="flat-panel fx-position-input-panel">
        <div className="flat-panel-head">
          <div className="panel-title">ポジション設定</div>
        </div>
        <div className="flat-panel-body">
          <div className="fx-position-input-grid">
            <fieldset className="field fx-position-side-field">
              <legend className="label">ポジション</legend>
              <div className="fx-position-side" aria-label="ポジション">
                <button
                  type="button"
                  className={positionSide === "buy" ? "active" : ""}
                  aria-pressed={positionSide === "buy"}
                  onClick={() => updateRiskField("position_side", "buy")}
                >
                  買い
                </button>
                <button
                  type="button"
                  className={positionSide === "sell" ? "active" : ""}
                  aria-pressed={positionSide === "sell"}
                  onClick={() => updateRiskField("position_side", "sell")}
                >
                  売り
                </button>
              </div>
            </fieldset>
            <label className="field">
              <span className="label">エントリー価格</span>
              <FormattedNumberInput
                value={risk.contract_rate}
                onChange={(value) => updateRiskField("contract_rate", value)}
              />
            </label>
            <div className="field">
              <span className="label">現在価格</span>
              <div
                className={`fx-current-rate-readonly ${marketStatus}`}
                aria-label={`現在価格 ${rate(currentRate)}円`}
              >
                <strong>{rate(currentRate)}</strong>
                <span>円</span>
              </div>
            </div>
            <label className="field">
              <span className="label">Lot</span>
              <FormattedNumberInput
                value={lots}
                onChange={(value) => updateRiskField("units", Math.max(0, value) * USD_PER_LOT)}
              />
            </label>
            <label className="field">
              <span className="label">エントリー日</span>
              <input
                className="input"
                type="date"
                max={todayString()}
                value={entryDate}
                onChange={(event) => updateRiskField("entry_date", event.target.value)}
              />
            </label>
            <label className="field">
              <span className="label">1日あたりスワップ</span>
              <MoneyInput
                value={risk.swap_per_unit}
                onChange={(value) => updateRiskField("swap_per_unit", value)}
              />
            </label>
            <label className="field">
              <span className="label">初期保証金</span>
              <MoneyInput
                value={risk.margin}
                onChange={(value) => updateRiskField("margin", Math.max(0, value))}
              />
            </label>
            <label className="field">
              <span className="label">追加保証金</span>
              <MoneyInput
                value={risk.extra_margin}
                onChange={(value) => updateRiskField("extra_margin", Math.max(0, value))}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="fx-risk-kpis" aria-label="FX計算結果">
        <div className={`fx-risk-kpi ${unrealizedProfit >= 0 ? "positive" : "negative"}`}>
          <span>含み損益</span>
          <strong>{signedMoney(unrealizedProfit)}</strong>
        </div>
        <div className={`fx-risk-kpi ${maintenanceRatio >= 100 ? "positive" : "negative"}`}>
          <span>保証金維持率</span>
          <strong>{ratio(maintenanceRatio)}</strong>
        </div>
        <div className={`fx-risk-kpi ${shortage > 0 ? "negative" : "safe"}`}>
          <span>不足保証金</span>
          <strong>{money(shortage)}</strong>
        </div>
      </div>

      {marketStatus === "error" && (
        <div className="notice" role="status">
          最新レートを取得できなかったため、前回保存した現在値で計算しています。
        </div>
      )}

      {historicalRows.length > 0 ? (
        <div className="fx-chart-grid">
          <MultiLineChart
            title="含み損益の推移"
            rows={historicalRows}
            series={[{ key: "profit", label: "含み損益", colorIndex: 1 }]}
            showYAxis
            fitToWidth
            areaKey="profit"
            chartHeight={260}
            valueFormatter={money}
          />
          <MultiLineChart
            title="USD/JPY 終値と維持率100%レート"
            rows={historicalRows}
            series={[
              { key: "close", label: "USD/JPY 終値", colorIndex: 0 },
              {
                key: "maintenanceRate",
                label: `維持率100%（${rate(maintenanceRate)}円）`,
                colorIndex: 4,
                dashed: true,
              },
            ]}
            fitToWidth
            chartHeight={260}
            valueFormatter={(value) => `${rate(value)}円`}
          />
        </div>
      ) : marketStatus === "loading" ? (
        <div className="notice" role="status">チャートデータを読み込み中です</div>
      ) : null}

      <div className="flat-panel fx-confirmed-profit-panel">
        <div className="flat-panel-head">
          <div>
            <div className="panel-title">FX確定損益</div>
            <p className="fx-panel-note">決済済みの損益を記録</p>
          </div>
        </div>
        <div className="flat-panel-body">
          <div className="fx-record-form">
            <div className="fx-date-block">
              <span className="label">日付</span>
              <div className="fx-date-picker-row fx-date-picker-row-fixed">
                <div className="fx-date-select-grid">
                  <label className="field">
                    <span className="label">年</span>
                    <select
                      className="input editable-input"
                      value={(recordDate || todayString()).slice(0, 4)}
                      onChange={(event) => {
                        const month = (recordDate || todayString()).slice(5, 7);
                        const day = Math.min(
                          Number((recordDate || todayString()).slice(8, 10)),
                          daysInMonth(event.target.value, month),
                        );
                        setRecordDate(`${event.target.value}-${month}-${String(day).padStart(2, "0")}`);
                      }}
                    >
                      {yearOptionsForFx().map((year) => (
                        <option key={year} value={year}>{year}年</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="label">月</span>
                    <select
                      className="input editable-input"
                      value={(recordDate || todayString()).slice(5, 7)}
                      onChange={(event) => {
                        const year = (recordDate || todayString()).slice(0, 4);
                        const day = Math.min(
                          Number((recordDate || todayString()).slice(8, 10)),
                          daysInMonth(year, event.target.value),
                        );
                        setRecordDate(`${year}-${event.target.value}-${String(day).padStart(2, "0")}`);
                      }}
                    >
                      {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((month) => (
                        <option key={month} value={month}>{Number(month)}月</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="label">日</span>
                    <select
                      className="input editable-input"
                      value={(recordDate || todayString()).slice(8, 10)}
                      onChange={(event) => {
                        const base = recordDate || todayString();
                        setRecordDate(`${base.slice(0, 4)}-${base.slice(5, 7)}-${event.target.value}`);
                      }}
                    >
                      {Array.from(
                        {
                          length: daysInMonth(
                            (recordDate || todayString()).slice(0, 4),
                            (recordDate || todayString()).slice(5, 7),
                          ),
                        },
                        (_, index) => String(index + 1).padStart(2, "0"),
                      ).map((day) => (
                        <option key={day} value={day}>{Number(day)}日</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="fx-date-nav-row">
                  <button className="month-arrow fx-date-nav-btn" type="button" onClick={() => setRecordDate(addDays(recordDate, -1))}>前日</button>
                  <button className="month-arrow fx-date-nav-btn" type="button" onClick={() => setRecordDate(todayString())}>今日</button>
                  <button className="month-arrow fx-date-nav-btn" type="button" onClick={() => setRecordDate(addDays(recordDate, 1))}>翌日</button>
                </div>
              </div>
            </div>
            <label className="field">
              <span className="label">損益</span>
              <MoneyInput value={recordResult} onChange={setRecordResult} commitOnBlur />
            </label>
            <button className="btn primary full-width" type="button" onClick={recordFxResult}>記録</button>
          </div>
        </div>
      </div>

      <FxTable rows={rows} onSelect={setSelectedFxId} onDelete={deleteFx} />
    </section>
  );
}
