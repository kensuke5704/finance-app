"use client";

import { memo, type ReactNode } from "react";
import { money, signedMoney } from "./financeUtils";
import { MoneyInput } from "./FinanceInputs";

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
  onBudgetChange,
}: {
  label: string;
  budget: number | null;
  actual: number;
  onChange: (value: number) => void;
  onBudgetChange?: (value: number) => void;
}) {
  return (
    <div className="budget-actual-card">
      <div className="budget-actual-label">{label}</div>
      <div className={`budget-actual-two-col ${budget === null ? "actual-only" : ""}`}>
        {budget !== null && (
          <div className="readonly-box">
            <span className="mini-label">予算</span>
            <b>{money(budget)}</b>
          </div>
        )}
        <label className="actual-input-box">
          <span className="mini-label">実績</span>
          <MoneyInput value={actual} onChange={onChange} commitOnBlur />
        </label>
      </div>
    </div>
  );
}

export const MemoBudgetActualRow = memo(BudgetActualRow);

export function BudgetActualSummary({
  label,
  budget,
  actual,
  emphasis = false,
  compact = false,
  onBudgetChange,
}: {
  label: string;
  budget: number;
  actual: number;
  emphasis?: boolean;
  compact?: boolean;
  onBudgetChange?: (value: number) => void;
}) {
  return (
    <div
      className={`budget-summary-card ${emphasis ? "emphasis" : ""} ${compact ? "compact" : ""}`}
    >
      <div className="budget-actual-label">{label}</div>
      <div className="budget-actual-two-col">
        <div className="readonly-box">
          <span className="mini-label">予算</span>
          <b>{money(budget)}</b>
        </div>
        <div className="readonly-box actual-result-box">
          <span className="mini-label">実績</span>
          <b>{money(actual)}</b>
        </div>
      </div>
    </div>
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
        <b className={value < 0 ? "negative" : "positive"}>
          {signedMoney(value)}
        </b>
      )}
    </div>
  );
}

