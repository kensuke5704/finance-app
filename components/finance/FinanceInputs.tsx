"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatCount,
  formatMoneyInput,
  n,
  parseMoneyInput,
  parsePlainNumberInput,
} from "./financeUtils";

export function MonthInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      className="input"
      type="month"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function NumberInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      className="input"
      type="number"
      value={value}
      onChange={(e) => onChange(n(e.target.value))}
    />
  );
}

export function FormattedNumberInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(formatCount(value));

  useEffect(() => {
    if (!focused) setDraft(formatCount(value));
  }, [value, focused]);

  return (
    <input
      className="input number-input"
      inputMode="decimal"
      value={focused ? draft : formatCount(value)}
      onFocus={() => {
        setFocused(true);
        setDraft(value ? String(value) : "");
      }}
      onBlur={() => {
        const nextValue = parsePlainNumberInput(draft);
        onChange(nextValue);
        setFocused(false);
        setDraft(formatCount(nextValue));
      }}
      onChange={(event) => setDraft(event.target.value)}
    />
  );
}

export function MoneyInput({
  value,
  onChange,
  commitOnBlur = false,
}: {
  value: number;
  onChange: (value: number) => void;
  commitOnBlur?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(formatMoneyInput(value));
  const changeTimerRef = useRef<number | null>(null);
  const latestValueRef = useRef(value);

  useEffect(() => {
    latestValueRef.current = value;
    if (!focused) setDraft(formatMoneyInput(value));
  }, [value, focused]);

  useEffect(() => {
    return () => {
      if (changeTimerRef.current) window.clearTimeout(changeTimerRef.current);
    };
  }, []);

  const commit = (nextValue: number) => {
    if (changeTimerRef.current) {
      window.clearTimeout(changeTimerRef.current);
      changeTimerRef.current = null;
    }
    if (nextValue !== latestValueRef.current) {
      latestValueRef.current = nextValue;
      onChange(nextValue);
    }
  };

  const scheduleCommit = (nextValue: number) => {
    if (changeTimerRef.current) window.clearTimeout(changeTimerRef.current);
    changeTimerRef.current = window.setTimeout(() => {
      commit(nextValue);
    }, 250);
  };

  return (
    <div className="money-input-wrap">
      <input
        className="input money-input"
        inputMode="text"
        value={focused ? draft : formatMoneyInput(value)}
        placeholder="0"
        onFocus={() => {
          setFocused(true);
          setDraft(value ? String(Math.round(value)) : "");
        }}
        onBlur={() => {
          const nextValue = parseMoneyInput(draft);
          commit(nextValue);
          setFocused(false);
          setDraft(formatMoneyInput(nextValue));
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            const nextValue = parseMoneyInput(draft);
            commit(nextValue);
            event.currentTarget.blur();
          }
        }}
        onChange={(e) => {
          const next = e.target.value;
          const nextValue = parseMoneyInput(next);
          setDraft(next);
          if (!commitOnBlur) scheduleCommit(nextValue);
        }}
      />
      <span className="money-input-unit">円</span>
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className="input"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}


type ConfirmDialogConfig = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
};

export function ConfirmDialog({ config, onClose }: { config: ConfirmDialogConfig | null; onClose: () => void }) {
  if (!config) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-title">{config.title}</div>
        <p className="modal-message">{config.message}</p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn"
            onClick={() => {
              config.onCancel?.();
              onClose();
            }}
          >
            {config.cancelLabel ?? "キャンセル"}
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              config.onConfirm();
              onClose();
            }}
          >
            {config.confirmLabel ?? "OK"}
          </button>
        </div>
      </div>
    </div>
  );

}
