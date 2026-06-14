"use client";

import { memo, type ReactNode } from "react";
import { formatMoneyInput, money, signedMoney } from "./financeUtils";
import { MoneyInput } from "./FinanceInputs";

function displayLabel(label: string) {
  return label === "クレジットカード支出" ? "カード支出" : label;
}

export function ShortKInputSection({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="short-k-input-section">
      <button className="short-k-input-section-head" onClick={onToggle}>
        <span>
          {open ? "▼" : "▶"} {title}
        </span>
        {summary && <span className="section-head-summary">{summary}</span>}
      </button>
      {open && <div className="short-k-input-section-body">{children}</div>}
    </div>
  );
}

export function BudgetActualRow({
  label,
  budget,
  actual,
  onChange,
}: {
  label: string;
  budget: number | null;
  actual: number;
  onChange: (value: number) => void;
  onBudgetChange?: (value: number) => void;
}) {
  return (
    <div className="budget-actual-card compact-actual-row">
      <div className="budget-actual-inline-label">{displayLabel(label)}</div>
      <div className="budget-actual-inline-value">
        <span>(</span>
        <span className="inline-money-input"><MoneyInput value={actual} onChange={onChange} commitOnBlur /></span>
        <span>)</span>
        {budget !== null ? <><span>/</span><span>{money(budget)}</span></> : <span>円</span>}
      </div>
    </div>
  );
}

export const MemoBudgetActualRow = memo(BudgetActualRow);

export function BudgetActualSummary({
  label,
  budget,
  actual,
  compact = false,
}: {
  label: string;
  budget: number;
  actual: number;
  emphasis?: boolean;
  compact?: boolean;
  onBudgetChange?: (value: number) => void;
}) {
  if (!compact) return null;

  return (
    <span className="compact-budget-ratio" aria-label={`${label} ${formatMoneyInput(actual)}円 / ${formatMoneyInput(budget)}円`}>
      <b>{formatMoneyInput(actual)}</b>
      <span>/</span>
      <span>{formatMoneyInput(budget)}円</span>
    </span>
  );
}

export const MemoBudgetActualSummary = memo(BudgetActualSummary);

export function BudgetVarianceCard({ value }: { value: number | null }) {
  return (
    <div className="result-card">
      <span>対予算</span>
      {value === null ? (
        <b className="muted-value">&nbsp;</b>
      ) : (
        <b className={value < 0 ? "negative" : "positive"}>{signedMoney(value)}</b>
      )}
    </div>
  );
}
