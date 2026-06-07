"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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
  const years: string[] = [];
  for (let year = current - 5; year <= current + 5; year += 1) years.push(String(year));
  return years;
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
              onSubmit({ name: name.trim(), code: code.trim(), units: Math.max(0, units), price });
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

  useEffect(() => {
    const id = window.setInterval(() => setRecordDate(todayString()), 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  const recordFxResult = () => {
    addFx({ date: recordDate || todayString(), result: recordResult, memo: null });
    setRecordResult(0);
  };

  return (
    <section className="stack fx-asset-view">
      <div className="flat-panel">
        <div className="flat-panel-head">
          <div className="panel-title">FX確定損益</div>
        </div>
        <div className="flat-panel-body">
          <div className="fx-record-form">
            <div className="fx-date-block">
              <span className="label">日付</span>
              <div className="month-picker-row fx-date-picker-row">
                <div className="fx-date-select-grid">
                  <label className="field">
                    <span className="label">年</span>
                    <select
                      className="input editable-input"
                      value={(recordDate || todayString()).slice(0, 4)}
                      onChange={(event) => {
                        const month = (recordDate || todayString()).slice(5, 7);
                        const day = Math.min(Number((recordDate || todayString()).slice(8, 10)), daysInMonth(event.target.value, month));
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
                        const day = Math.min(Number((recordDate || todayString()).slice(8, 10)), daysInMonth(year, event.target.value));
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
                      {Array.from({ length: daysInMonth((recordDate || todayString()).slice(0, 4), (recordDate || todayString()).slice(5, 7)) }, (_, index) => String(index + 1).padStart(2, "0")).map((day) => (
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

