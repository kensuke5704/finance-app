"use client";

import { memo, type ReactNode, useEffect, useState } from "react";
import { formatMoneyInput, money, parseMoneyInput, signedMoney } from "./financeUtils";

function displayLabel(label: string) {
  return label === "クレジットカード支出" ? "カード支出" : label;
}

function InlineAmountInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(formatMoneyInput(value));
  const [focused, setFocused] = useState(false);
  const displayValue = formatMoneyInput(value) || "0";

  useEffect(() => {
    if (!focused) setDraft(formatMoneyInput(value));
  }, [focused, value]);

  return (
    <input
      className="inline-amount-input"
      inputMode="numeric"
      value={focused ? draft : displayValue}
      onFocus={() => {
        setFocused(true);
        setDraft(value ? String(Math.round(value)) : "");
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const nextValue = parseMoneyInput(draft);
        onChange(nextValue);
        setFocused(false);
        setDraft(formatMoneyInput(nextValue));
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
    />
  );
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
      <div className="budget-actual-budget-value">
        {budget !== null ? money(budget) : money(0)}
      </div>
      <div className="budget-actual-input-value">
        <InlineAmountInput value={actual} onChange={onChange} />
        <span>円</span>
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
  const budgetText = formatMoneyInput(budget) || "0";
  const actualText = formatMoneyInput(actual) || "0";

  return (
    <span className="compact-budget-ratio" aria-label={`${label} ${actualText}円 / ${budgetText}円`}>
      <span>{budgetText}円</span>
      <b>{actualText}円</b>
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
