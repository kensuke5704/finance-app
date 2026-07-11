"use client";

import { useMemo, useState } from "react";
import type { FinanceSettings, MonthlyRecord } from "../../types/finance";
import type { ShortKBudget } from "./FinanceShared";
import {
  SHORT_K_END,
  SHORT_K_START,
  ConfirmDialog,
  MoneyInput,
  NumberInput,
  blankMonthly,
  buildShortKNote,
  currentMonthString,
  monthsBetween,
  parseShortKActuals,
  shortKBudget,
  shortKBudgetInvestmentTotal,
} from "./FinanceShared";

export function BudgetSettingsView({
  rows,
  settings,
  updateSettings,
  selectedMonth,
  setSelectedMonth,
  upsertMonthly,
  secondaryProfile = false,
  onGiftChange,
}: {
  rows: MonthlyRecord[];
  settings: FinanceSettings;
  updateSettings: (settings: FinanceSettings) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  upsertMonthly: (month: string, patch: Partial<MonthlyRecord>) => void;
  secondaryProfile?: boolean;
  onGiftChange?: (month: string, type: "actual" | "budget", value: number) => void;
}) {
  const defaultSelectedMonth = selectedMonth || currentMonthString();
  const [settingsTab, setSettingsTab] = useState<"calculation" | "budget">("calculation");
  const selectedMonthKey = defaultSelectedMonth;
  const budgetMonths = useMemo(
    () => monthsBetween(SHORT_K_START, SHORT_K_END).reverse(),
    [],
  );
  const budgetYears = useMemo(
    () => Array.from(new Set(budgetMonths.map((month) => month.slice(0, 4)))),
    [budgetMonths],
  );
  const [budgetYear, setBudgetYear] = useState(
    defaultSelectedMonth.slice(0, 4) || currentMonthString().slice(0, 4),
  );
  const visibleBudgetMonths = useMemo(
    () => budgetMonths.filter((month) => month.startsWith(`${budgetYear}-`)),
    [budgetMonths, budgetYear],
  );
  const [pendingBudgetChange, setPendingBudgetChange] = useState<{
    month: string;
    key: keyof ShortKBudget;
    value: number;
  } | null>(null);

  const budgetColumns: { key: keyof ShortKBudget; label: string; emptyWhenZero?: boolean }[] =
    secondaryProfile
      ? [
          { key: "incomeCashBudget", label: "現金収入", emptyWhenZero: true },
          { key: "incomeInvestmentBudget", label: "投資収入", emptyWhenZero: true },
          { key: "outgoBudget", label: "支出", emptyWhenZero: true },
          { key: "giftOutgoBudget", label: "贈与", emptyWhenZero: true },
          { key: "fundInvestmentBudget", label: "投資信託", emptyWhenZero: true },
        ]
      : [
          { key: "incomeCashBudget", label: "現金収入" },
          { key: "incomeInvestmentBudget", label: "投資収入" },
          { key: "giftIncomeBudget", label: "贈与" },
          { key: "outgoBudget", label: "支出" },
          { key: "fundInvestmentBudget", label: "投資信託" },
          { key: "activeInvestmentBudget", label: "アクティブ" },
          { key: "usdInvestmentBudget", label: "FX" },
        ];

  const applyBudgetChange = (
    month: string,
    key: keyof ShortKBudget,
    value: number,
    applyToFuture: boolean,
  ) => {
    if (!month) return;
    const targetMonths = applyToFuture ? monthsBetween(month, SHORT_K_END) : [month];

    targetMonths.forEach((targetMonth) => {
      const targetRow = rows.find((row) => row.month === targetMonth);
      const targetBudgetRow = targetRow && secondaryProfile
        ? { ...targetRow, user_key: "secondary" }
        : targetRow;
      const targetActuals = parseShortKActuals(targetRow);
      const targetBudget = {
        ...shortKBudget(
          targetMonth,
          targetBudgetRow ?? (secondaryProfile
            ? { ...blankMonthly(targetMonth), user_key: "secondary" }
            : undefined),
        ),
        [key]: value,
      };
      upsertMonthly(targetMonth, {
        income_budget: targetBudget.incomeCashBudget,
        outgo_budget: targetBudget.outgoBudget,
        invest_budget: shortKBudgetInvestmentTotal(targetBudget),
        cash_prediction: targetBudget.cashPrediction,
        note: buildShortKNote(targetRow, targetActuals, { [key]: value }),
      });
      if (key === "giftIncomeBudget" || key === "giftOutgoBudget") {
        onGiftChange?.(targetMonth, "budget", value);
      }
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
      giftIncomeBudget: "贈与",
      giftOutgoBudget: "贈与",
    })[key];

  const budgetForMonth = (month: string) => {
    const row = rows.find((item) => item.month === month);
    return shortKBudget(
      month,
      row ?? (secondaryProfile ? { ...blankMonthly(month), user_key: "secondary" } : undefined),
    );
  };

  const updateBudget = (month: string, key: keyof ShortKBudget, value: number) => {
    if (!month) return;
    setSelectedMonth(month);
    setPendingBudgetChange({ month, key, value });
  };

  return (
    <section className="stack">
      <div className="flat-panel">
        <div className="flat-panel-head">
          <div className="panel-title">設定</div>
        </div>
        <div className="flat-panel-body">
          <div className="settings-inner-tabs chart-tabs" role="tablist" aria-label="設定メニュー">
            <button
              className={`chart-tab ${settingsTab === "calculation" ? "active" : ""}`}
              type="button"
              onClick={() => setSettingsTab("calculation")}
            >
              計算設定
            </button>
            <button
              className={`chart-tab ${settingsTab === "budget" ? "active" : ""}`}
              type="button"
              onClick={() => setSettingsTab("budget")}
            >
              月次予算
            </button>
          </div>

          {settingsTab === "calculation" ? (
            <div className="settings-section settings-tab-panel">
              <div className="settings-section-heading">
                <div>
                  <p className="settings-section-kicker">Calculation</p>
                  <h2 className="settings-section-title">計算設定</h2>
                </div>
              </div>
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
                {!secondaryProfile && (
                  <>
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
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="settings-section settings-tab-panel monthly-budget-panel">
              <div className="settings-section-heading">
                <div>
                  <p className="settings-section-kicker">Monthly Budget</p>
                  <h2 className="settings-section-title">月次予算</h2>
                </div>
                <span className="auto-backup-badge">変更時に以降月へ反映可能</span>
              </div>
              <div className="monthly-budget-toolbar">
                <label className="field">
                  <span className="label">対象年</span>
                  <select
                    className="input editable-input"
                    value={budgetYear}
                    onChange={(event) => setBudgetYear(event.target.value)}
                  >
                    {budgetYears.map((year) => (
                      <option key={year} value={year}>{year}年</option>
                    ))}
                  </select>
                </label>
                <p>各金額を変更すると、この月だけ、または以降の月へ反映できます。</p>
              </div>
              <div className="table-wrap monthly-budget-table-wrap">
                <table className="monthly-budget-table">
                  <thead>
                    <tr>
                      <th>月</th>
                      {budgetColumns.map((column) => (
                        <th key={column.key} className="num">{column.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleBudgetMonths.map((month) => {
                      const budget = budgetForMonth(month);
                      return (
                        <tr key={month} className={month === selectedMonthKey ? "active-budget-month" : ""}>
                          <td>
                            <button
                              className="btn"
                              type="button"
                              onClick={() => setSelectedMonth(month)}
                            >
                              {month}
                            </button>
                          </td>
                          {budgetColumns.map((column) => (
                            <td key={column.key} className="num monthly-budget-cell">
                              <MoneyInput
                                value={Number(budget[column.key] ?? 0)}
                                onChange={(value) => updateBudget(month, column.key, value)}
                                commitOnBlur
                                emptyWhenZero={column.emptyWhenZero}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
                onCancel: () =>
                  applyBudgetChange(
                    pendingBudgetChange.month,
                    pendingBudgetChange.key,
                    pendingBudgetChange.value,
                    false,
                  ),
                onConfirm: () =>
                  applyBudgetChange(
                    pendingBudgetChange.month,
                    pendingBudgetChange.key,
                    pendingBudgetChange.value,
                    true,
                  ),
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
  emptyWhenZero = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  emptyWhenZero?: boolean;
}) {
  return (
    <label className="budget-setting-row">
      <span className="budget-actual-label">{label}</span>
      <MoneyInput
        value={value}
        onChange={onChange}
        commitOnBlur
        emptyWhenZero={emptyWhenZero}
      />
    </label>
  );
}
