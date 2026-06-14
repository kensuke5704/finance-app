"use client";

import { useEffect, useState } from "react";
import type { FinanceSettings, MonthlyRecord } from "../../types/finance";
import type { ShortKBudget } from "./FinanceShared";
import {
  SHORT_K_END,
  SHORT_K_START,
  ConfirmDialog,
  MoneyInput,
  NumberInput,
  buildShortKNote,
  currentMonthString,
  inMonthRange,
  monthlyForMonth,
  monthsBetween,
  parseShortKActuals,
  shortKBudget,
  shortKBudgetInvestmentTotal,
  shortKMonthOptions,
  shortKYearOptions,
} from "./FinanceShared";

export function BudgetSettingsView({
  rows,
  settings,
  updateSettings,
  selectedMonth,
  setSelectedMonth,
  upsertMonthly,
}: {
  rows: MonthlyRecord[];
  settings: FinanceSettings;
  updateSettings: (settings: FinanceSettings) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  upsertMonthly: (month: string, patch: Partial<MonthlyRecord>) => void;
}) {
  const defaultSelectedMonth = selectedMonth || currentMonthString();
  const [selectedYear, setSelectedYear] = useState(defaultSelectedMonth.slice(0, 4));
  const [selectedMonthNumber, setSelectedMonthNumber] = useState(defaultSelectedMonth.slice(5, 7));
  const [openCalculation, setOpenCalculation] = useState(false);
  const [openBudget, setOpenBudget] = useState(false);

  useEffect(() => {
    const nextSelectedMonth = selectedMonth || currentMonthString();
    setSelectedYear(nextSelectedMonth.slice(0, 4));
    setSelectedMonthNumber(nextSelectedMonth.slice(5, 7));
  }, [selectedMonth]);

  const selectedMonthKey = selectedYear && selectedMonthNumber ? `${selectedYear}-${selectedMonthNumber}` : "";
  const selectedMonthly = selectedMonthKey ? monthlyForMonth(rows, selectedMonthKey) : undefined;
  const selectedActuals = parseShortKActuals(selectedMonthly);
  const selectedBudget = shortKBudget(selectedMonthKey, selectedMonthly);
  const [pendingBudgetChange, setPendingBudgetChange] = useState<{
    key: keyof ShortKBudget;
    value: number;
  } | null>(null);

  const applyBudgetChange = (
    key: keyof ShortKBudget,
    value: number,
    applyToFuture: boolean,
  ) => {
    if (!selectedMonthKey) return;
    const targetMonths = applyToFuture ? monthsBetween(selectedMonthKey, SHORT_K_END) : [selectedMonthKey];

    targetMonths.forEach((targetMonth) => {
      const targetRow = rows.find((row) => row.month === targetMonth);
      const targetActuals = parseShortKActuals(targetRow);
      const targetBudget = {
        ...shortKBudget(targetMonth, targetRow),
        [key]: value,
      };
      upsertMonthly(targetMonth, {
        income_budget: targetBudget.incomeCashBudget,
        outgo_budget: targetBudget.outgoBudget,
        invest_budget: shortKBudgetInvestmentTotal(targetBudget),
        cash_prediction: targetBudget.cashPrediction,
        note: buildShortKNote(targetRow, targetActuals, { [key]: value }),
      });
    });
  };

  const budgetLabel = (key: keyof ShortKBudget) =>
    ({
      incomeCashBudget: "現金収入",
      incomeInvestmentBudget: "投資収入",
      outgoBudget: "支出",
      fundInvestmentBudget: "投資信託",
      activeInvestmentBudget: "アクティブ",
      usdInvestmentBudget: "FX",
      cashPrediction: "現金予測",
    })[key];

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

  const updateBudget = (key: keyof ShortKBudget, value: number) => {
    if (!selectedMonthKey) return;
    setPendingBudgetChange({ key, value });
  };

  return (
    <section className="stack">
      <div className="flat-panel">
        <div className="flat-panel-head">
          <div className="panel-title">設定</div>
        </div>
        <div className="flat-panel-body">
          <div className="month-picker-row">
            <button
              className="month-arrow"
              type="button"
              onClick={() => moveSelectedShortKMonth(-1)}
              disabled={!selectedMonthKey || selectedMonthKey <= SHORT_K_START}
            >
              ←
            </button>
            <div className="month-select-grid">
              <label className="field">
                <span className="label">年</span>
                <select
                  className="input editable-input"
                  value={selectedYear}
                  onChange={(e) => updateSelectedYear(e.target.value)}
                >
                  <option value="">選択</option>
                  {shortKYearOptions().map((year) => (
                    <option key={year} value={year}>{year}年</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">月</span>
                <select
                  className="input editable-input"
                  value={selectedMonthNumber}
                  onChange={(e) => updateSelectedMonthNumber(e.target.value)}
                  disabled={!selectedYear}
                >
                  <option value="">選択</option>
                  {shortKMonthOptions(selectedYear).map((month) => (
                    <option key={month} value={month}>{Number(month)}月</option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="month-arrow"
              type="button"
              onClick={() => moveSelectedShortKMonth(1)}
              disabled={!selectedMonthKey || selectedMonthKey >= SHORT_K_END}
            >
              →
            </button>
          </div>

          <div className="settings-section collapsible-settings-section">
            <button
              className="short-k-input-section-head"
              type="button"
              onClick={() => setOpenCalculation((current) => !current)}
            >
              <span>{openCalculation ? "▼" : "▶"} 計算設定</span>
            </button>
            {openCalculation && (
              <div className="budget-settings-list settings-collapse-body">
                <AnnualReturnSettingRow
                  label="投資信託"
                  value={settings.annualReturnRates.fund}
                  onChange={(value) =>
                    updateSettings({
                      ...settings,
                      annualReturnRates: { ...settings.annualReturnRates, fund: value },
                    })
                  }
                />
                <AnnualReturnSettingRow
                  label="アクティブ"
                  value={settings.annualReturnRates.active}
                  onChange={(value) =>
                    updateSettings({
                      ...settings,
                      annualReturnRates: { ...settings.annualReturnRates, active: value },
                    })
                  }
                />
                <AnnualReturnSettingRow
                  label="FX"
                  value={settings.annualReturnRates.usd}
                  onChange={(value) =>
                    updateSettings({
                      ...settings,
                      annualReturnRates: { ...settings.annualReturnRates, usd: value },
                    })
                  }
                />
              </div>
            )}
          </div>

          <div className="settings-section collapsible-settings-section">
            <button
              className="short-k-input-section-head"
              type="button"
              onClick={() => setOpenBudget((current) => !current)}
            >
              <span>{openBudget ? "▼" : "▶"} 月次予算</span>
            </button>
            {openBudget && (
              !selectedMonthKey ? (
                <div className="empty-state settings-collapse-body">年と月を選択してください。</div>
              ) : (
                <div className="budget-settings-list settings-collapse-body">
                  <BudgetSettingRow
                    label="現金収入"
                    value={selectedBudget.incomeCashBudget}
                    onChange={(value) => updateBudget("incomeCashBudget", value)}
                  />
                  <BudgetSettingRow
                    label="投資収入"
                    value={selectedBudget.incomeInvestmentBudget}
                    onChange={(value) => updateBudget("incomeInvestmentBudget", value)}
                  />
                  <BudgetSettingRow
                    label="支出"
                    value={selectedBudget.outgoBudget}
                    onChange={(value) => updateBudget("outgoBudget", value)}
                  />
                  <BudgetSettingRow
                    label="投資信託"
                    value={selectedBudget.fundInvestmentBudget}
                    onChange={(value) => updateBudget("fundInvestmentBudget", value)}
                  />
                  <BudgetSettingRow
                    label="アクティブ"
                    value={selectedBudget.activeInvestmentBudget}
                    onChange={(value) => updateBudget("activeInvestmentBudget", value)}
                  />
                  <BudgetSettingRow
                    label="FX"
                    value={selectedBudget.usdInvestmentBudget}
                    onChange={(value) => updateBudget("usdInvestmentBudget", value)}
                  />
                </div>
              )
            )}
          </div>
        </div>
      </div>
      <ConfirmDialog
        config={
          pendingBudgetChange
            ? {
                title: "予算を変更",
                message: `${budgetLabel(pendingBudgetChange.key)}を以降の月にも反映しますか？`,
                cancelLabel: "この月のみ",
                confirmLabel: "OK",
                onCancel: () => applyBudgetChange(pendingBudgetChange.key, pendingBudgetChange.value, false),
                onConfirm: () => applyBudgetChange(pendingBudgetChange.key, pendingBudgetChange.value, true),
              }
            : null
        }
        onClose={() => setPendingBudgetChange(null)}
      />
    </section>
  );
}

function AnnualReturnSettingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const monthlyRate = Math.pow(1 + value, 1 / 12) - 1;
  return (
    <label className="budget-setting-row annual-return-setting-row">
      <span className="budget-actual-label">{label}</span>
      <div className="rate-input-wrap">
        <NumberInput
          value={Math.round(value * 10000) / 100}
          onChange={(nextValue) => onChange(nextValue / 100)}
        />
        <span className="rate-input-unit">%</span>
        <span className="rate-monthly-note">月利 {(monthlyRate * 100).toFixed(2)}%</span>
      </div>
    </label>
  );
}

function BudgetSettingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="budget-setting-row">
      <span className="budget-actual-label">{label}</span>
      <MoneyInput value={value} onChange={onChange} commitOnBlur />
    </label>
  );
}
