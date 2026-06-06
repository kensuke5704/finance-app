"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { MonthlyRecord } from "../../types/finance";
import { money } from "./financeUtils";
import {
  SHORT_K_MONTHLY_OPEN_YEARS_STORAGE_KEY,
  ConfirmDialog,
  actualAccount,
  displayMonth,
  parseShortKActuals,
  previousMonth,
  readLocalStorage,
  shortKCalculatedDeposit,
  shortKIncomeTotal,
  shortKInvestmentTotal,
  shortKOutgoTotal,
  writeLocalStorage,
} from "./FinanceShared";

export function CollapsiblePanel({
  title,
  badge,
  open,
  setOpen,
  children,
}: {
  title: string;
  badge?: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="panel">
      <button
        className="panel-head collapse-head"
        onClick={() => setOpen(!open)}
      >
        <div className="panel-title">
          {open ? "▼" : "▶"} {title}
        </div>
        {badge && <span className="badge">{badge}</span>}
      </button>
      {open && <div className="panel-body">{children}</div>}
    </div>
  );
}

export function LineLikeChart({
  title,
  rows,
}: {
  title: string;
  badge?: string;
  rows: { label: string; value: number }[];
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">{title}</div>
        <span className="badge">推移</span>
      </div>
      <div className="panel-body">
        <div className="mini-chart">
          {rows.map((row) => (
            <div className="chart-item" key={row.label}>
              <div
                className="bar"
                style={{ height: `${Math.max((row.value / max) * 100, 4)}%` }}
              />
              <div className="chart-label">{row.label.slice(2)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MultiLineChart({
  title,
  rows,
  series,
  showYAxis = false,
  baselineZero = false,
  storageKey,
}: {
  title: string;
  badge?: string;
  rows: Record<string, string | number | undefined>[];
  series: {
    key: string;
    label: string;
    dashed?: boolean;
    colorIndex?: number;
    hideLegend?: boolean;
  }[];
  showYAxis?: boolean;
  baselineZero?: boolean;
  storageKey?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [selectedPoint, setSelectedPoint] = useState<{
    label: string;
    seriesLabel: string;
    value: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!storageKey) return;
    const savedZoom = Number(readLocalStorage(storageKey));
    if (Number.isFinite(savedZoom) && savedZoom > 0) {
      setZoom(savedZoom);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    writeLocalStorage(storageKey, String(zoom));
  }, [storageKey, zoom]);

  const chartValue = (
    row: Record<string, string | number | undefined>,
    key: string,
  ) => {
    const value = row[key];
    return typeof value === "number" && Number.isFinite(value)
      ? value
      : undefined;
  };

  const visibleWidth = 390;
  const height = 310;
  const axisWidth = showYAxis ? 58 : 0;
  const padLeft = showYAxis ? 8 : 24;
  const padRight = 18;
  const padTop = 22;
  const padBottom = 42;
  const plotBottom = height - padBottom;
  const baseStep = 18;
  const xStep = baseStep * zoom;
  const scrollViewportWidth = Math.max(160, visibleWidth - axisWidth);
  const minZoomForFullView = Math.max(0.02, (scrollViewportWidth - padLeft - padRight) / Math.max(Math.max(rows.length - 1, 1) * baseStep, 1));
  const width = Math.max(scrollViewportWidth, padLeft + padRight + Math.max(rows.length - 1, 1) * xStep);
  const visibleStart = Math.max(0, Math.floor((scrollLeft - padLeft) / xStep) - 2);
  const visibleCount = Math.ceil(scrollViewportWidth / xStep) + 6;
  const visibleEnd = Math.min(rows.length, visibleStart + visibleCount);
  const visibleRows = rows.slice(visibleStart, Math.max(visibleEnd, visibleStart + 1));
  const domainRows = visibleRows.length ? visibleRows : rows;
  const numericValues = domainRows.flatMap((row) =>
    series
      .map((item) => chartValue(row, item.key))
      .filter((value): value is number => value !== undefined),
  );
  const rawMax = Math.max(...numericValues, 1);
  const rawMin = Math.min(...numericValues, baselineZero ? 0 : 0);
  const roughRange = rawMax - rawMin || Math.max(Math.abs(rawMax), 100000);
  const tickStep = showYAxis
    ? Math.max(100000, Math.ceil(roughRange / 5 / 100000) * 100000)
    : 0;
  const min = showYAxis
    ? baselineZero
      ? 0
      : Math.floor((rawMin - tickStep * 0.5) / tickStep) * tickStep
    : rawMin;
  const max = showYAxis
    ? Math.max(min + tickStep, Math.ceil((rawMax + tickStep * 0.5) / tickStep) * tickStep)
    : rawMax;
  const range = Math.max(max - min, 1);
  const x = (index: number) => padLeft + index * xStep;
  const y = (value: number) =>
    padTop + (1 - (value - min) / range) * (plotBottom - padTop);
  const ticks = showYAxis
    ? Array.from(
        { length: Math.floor((max - min) / tickStep) + 1 },
        (_, index) => min + index * tickStep,
      )
    : [max, min + range / 2, min];

  const syncScrollLeft = () => {
    if (!wrapRef.current) return;
    setScrollLeft(wrapRef.current.scrollLeft);
  };

  const setChartZoom = (nextZoom: number, centerRatio = 0.5) => {
    const clamped = Math.min(4, Math.max(minZoomForFullView, nextZoom));
    const wrap = wrapRef.current;
    if (!wrap) {
      setZoom(clamped);
      return;
    }
    const previousZoom = zoom;
    const center = wrap.scrollLeft + wrap.clientWidth * centerRatio;
    const contentPoint = center / Math.max(previousZoom, 0.01);
    setZoom(clamped);
    window.requestAnimationFrame(() => {
      wrap.scrollLeft = Math.max(0, contentPoint * clamped - wrap.clientWidth * centerRatio);
      setScrollLeft(wrap.scrollLeft);
    });
  };

  const pinchDistance = (touches: { [index: number]: { clientX: number; clientY: number } }) => {
    const first = touches[0];
    const second = touches[1];
    return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
  };

  return (
    <div className="panel chart-panel">
      <div className="panel-head">
        <div className="panel-title">{title}</div>
      </div>
      <div className="panel-body">
        <div className={`chart-scroll-shell ${showYAxis ? "has-fixed-y-axis" : ""}`}>
          {showYAxis && (
            <svg
              className="fixed-y-axis-svg"
              viewBox={`0 0 ${axisWidth} ${height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <line
                x1={axisWidth - 1}
                y1={padTop}
                x2={axisWidth - 1}
                y2={plotBottom}
                className="chart-axis"
              />
              {ticks.map((tick) => {
                const gy = y(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={axisWidth - 6}
                      y1={gy}
                      x2={axisWidth - 1}
                      y2={gy}
                      className="chart-axis"
                    />
                    <text
                      x={axisWidth - 9}
                      y={gy + 5}
                      textAnchor="end"
                      className="chart-tick"
                    >
                      {Math.round(tick / 10000).toLocaleString("ja-JP")}万
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
          <div
            ref={wrapRef}
            className="line-chart-wrap fixed-chart-wrap"
            onScroll={syncScrollLeft}
            onWheel={(event) => {
              if (!event.ctrlKey && !event.metaKey) return;
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              const centerRatio = (event.clientX - rect.left) / Math.max(rect.width, 1);
              setChartZoom(zoom * (event.deltaY < 0 ? 1.12 : 0.88), centerRatio);
            }}
            onTouchStart={(event) => {
              if (event.touches.length !== 2) return;
              pinchRef.current = { distance: pinchDistance(event.touches), zoom };
            }}
            onTouchMove={(event) => {
              if (event.touches.length !== 2 || !pinchRef.current) return;
              event.preventDefault();
              const nextDistance = pinchDistance(event.touches);
              const rect = event.currentTarget.getBoundingClientRect();
              const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
              const centerRatio = (centerX - rect.left) / Math.max(rect.width, 1);
              setChartZoom(pinchRef.current.zoom * (nextDistance / pinchRef.current.distance), centerRatio);
            }}
            onTouchEnd={() => {
              pinchRef.current = null;
            }}
          >
            <svg
              className="line-chart"
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="xMinYMid meet"
              role="img"
            >
            <line
              x1={padLeft}
              y1={padTop}
              x2={padLeft}
              y2={plotBottom}
              className="chart-axis"
            />
            <line
              x1={padLeft}
              y1={plotBottom}
              x2={width - padRight}
              y2={plotBottom}
              className="chart-axis"
            />
            {ticks.map((tick) => {
              const gy = y(tick);
              return (
                <g key={tick}>
                  <line
                    x1={padLeft}
                    y1={gy}
                    x2={width - padRight}
                    y2={gy}
                    className="chart-grid"
                  />

                </g>
              );
            })}
            {series.map((item, sIndex) => {
              const points = rows
                .map((row, index) => {
                  const value = chartValue(row, item.key);
                  return value === undefined
                    ? undefined
                    : `${x(index)},${y(value)}`;
                })
                .filter((point): point is string => Boolean(point))
                .join(" ");
              return (
                <polyline
                  key={item.key}
                  points={points}
                  className={`line-series line-series-${item.colorIndex ?? sIndex % 6} ${item.dashed ? "line-series-dashed" : ""}`}
                />
              );
            })}
            {series.map((item, sIndex) =>
              rows.slice(visibleStart, visibleEnd).map((row, offset) => {
                const index = visibleStart + offset;
                const value = chartValue(row, item.key);
                if (value === undefined) return null;
                const cx = x(index);
                const cy = y(value);
                return (
                  <circle
                    key={`${item.key}-${String(row.label)}`}
                    cx={cx}
                    cy={cy}
                    r={Math.max(10, Math.min(18, xStep * 0.8))}
                    className="chart-hit-point"
                    onClick={() =>
                      setSelectedPoint({
                        label: String(row.label),
                        seriesLabel: item.label,
                        value,
                        x: cx,
                        y: cy,
                      })
                    }
                  />
                );
              }),
            )}
            {selectedPoint && (
              <g className="chart-point-popup">
                <rect
                  x={Math.min(Math.max(selectedPoint.x - 70, padLeft), width - padRight - 140)}
                  y={Math.max(selectedPoint.y - 58, padTop)}
                  width="140"
                  height="46"
                  rx="10"
                />
                <text
                  x={Math.min(Math.max(selectedPoint.x, padLeft + 70), width - padRight - 70)}
                  y={Math.max(selectedPoint.y - 39, padTop + 19)}
                  textAnchor="middle"
                >
                  {`${selectedPoint.label} ${selectedPoint.seriesLabel}`}
                </text>
                <text
                  x={Math.min(Math.max(selectedPoint.x, padLeft + 70), width - padRight - 70)}
                  y={Math.max(selectedPoint.y - 21, padTop + 37)}
                  textAnchor="middle"
                  className="chart-point-popup-value"
                >
                  {money(selectedPoint.value)}
                </text>
              </g>
            )}
            {rows.map((row, index) => {
              const label = String(row.label);
              const year = Number(label.slice(0, 4));
              const monthNumber = Number(label.slice(5, 7));
              const isYearStart = monthNumber === 1;
              const isQuarterStart = monthNumber === 1 || monthNumber === 4 || monthNumber === 7 || monthNumber === 10;
              const tickMode =
                xStep >= 34
                  ? "month"
                  : xStep >= 10
                    ? "quarter"
                    : xStep >= 1.2
                      ? "year"
                      : "threeYear";
              const shouldShowLabel =
                tickMode === "month"
                  ? true
                  : tickMode === "quarter"
                    ? isQuarterStart
                    : tickMode === "year"
                      ? isYearStart
                      : isYearStart && year % 3 === 0;
              const tickLabel =
                tickMode === "month"
                  ? isYearStart
                    ? `${year}`
                    : `${monthNumber}月`
                  : tickMode === "quarter"
                    ? isYearStart
                      ? `${year}`
                      : `${monthNumber}月`
                    : `${year}`;
              return (
                <g key={label}>
                  <line
                    x1={x(index)}
                    y1={plotBottom}
                    x2={x(index)}
                    y2={plotBottom + (isYearStart ? 9 : 5)}
                    className={
                      isYearStart ? "chart-year-mark" : "chart-month-mark"
                    }
                  />
                  {shouldShowLabel && (
                    <text
                      x={x(index)}
                      y={height - 12}
                      textAnchor="middle"
                      className="chart-tick"
                    >
                      {tickLabel}
                    </text>
                  )}
                </g>
              );
            })}
            </svg>
          </div>
        </div>
        <div className="chart-legend">
          {series
            .filter((item) => !item.hideLegend)
            .map((item, index) => (
              <span
                key={item.key}
                className={`legend-item line-series-${item.colorIndex ?? index % 6}`}
              >
                {item.label}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}

export function MonthlyTable({
  rows,
  onSelect,
  onDelete,
}: {
  rows: MonthlyRecord[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [pendingDeleteRow, setPendingDeleteRow] = useState<MonthlyRecord | null>(null);
  const groupedRows = useMemo(() => {
    const groups = new Map<string, MonthlyRecord[]>();
    [...rows]
      .sort((a, b) => b.month.localeCompare(a.month))
      .forEach((row) => {
        const year = row.month.slice(0, 4);
        const current = groups.get(year) ?? [];
        current.push(row);
        groups.set(year, current);
      });
    return Array.from(groups.entries()).map(([year, items]) => ({ year, items }));
  }, [rows]);
  const [openYears, setOpenYears] = useState<Record<string, boolean>>(() => {
    const saved = readLocalStorage(SHORT_K_MONTHLY_OPEN_YEARS_STORAGE_KEY);
    if (!saved) return {};
    try {
      const parsed = JSON.parse(saved) as Record<string, boolean>;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return parsed;
    } catch {
      return {};
    }
  });

  const availableYearsKey = groupedRows.map(({ year }) => year).join("|");

  useEffect(() => {
    const availableYears = new Set(groupedRows.map(({ year }) => year));
    setOpenYears((current) => {
      const normalized = Object.fromEntries(
        Object.entries(current).filter(([year]) => availableYears.has(year)),
      ) as Record<string, boolean>;
      if (Object.keys(normalized).length !== Object.keys(current).length) {
        writeLocalStorage(
          SHORT_K_MONTHLY_OPEN_YEARS_STORAGE_KEY,
          JSON.stringify(normalized),
        );
        return normalized;
      }
      return current;
    });
  }, [availableYearsKey]);

  const updateOpenYears = (updater: (current: Record<string, boolean>) => Record<string, boolean>) => {
    setOpenYears((current) => {
      const next = updater(current);
      writeLocalStorage(SHORT_K_MONTHLY_OPEN_YEARS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const rowSummaries = useMemo(() => {
    const map = new Map<string, {
      deposit: number;
      income: number;
      outgo: number;
      investment: number;
      account: number;
    }>();
    groupedRows
      .filter(({ year }) => openYears[year])
      .flatMap(({ items }) => items)
      .forEach((row) => {
        const actuals = parseShortKActuals(row);
        map.set(row.id, {
          deposit: shortKCalculatedDeposit(row.month, rows),
          income: shortKIncomeTotal(actuals),
          outgo: shortKOutgoTotal(
            actuals,
            parseShortKActuals(rows.find((item) => item.month === previousMonth(row.month))),
          ),
          investment: shortKInvestmentTotal(actuals),
          account: actualAccount(row),
        });
      });
    return map;
  }, [groupedRows, openYears, rows]);

  return (
    <div className="panel monthly-table-panel">
      <div className="panel-head">
        <div className="panel-title">月次一覧</div>
      </div>
      <div className="year-accordion-list">
        {groupedRows.map(({ year, items }) => {
          const open = Boolean(openYears[year]);
          return (
            <section className="year-accordion" key={year}>
              <button
                type="button"
                className="year-accordion-head"
                onClick={() =>
                  updateOpenYears((current) => ({
                    ...current,
                    [year]: !current[year],
                  }))
                }
              >
                <span>{open ? "▼" : "▶"} {year}年</span>
                <span>{items.length}件</span>
              </button>
              {open && (
                <div className="table-wrap monthly-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>月</th>
                        <th className="num">現金</th>
                        <th className="num">収入</th>
                        <th className="num">支出</th>
                        <th className="num">投資</th>
                        <th className="num">口座・外貨</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row) => {
                        const summary = rowSummaries.get(row.id);
                        return (
                          <tr key={row.id}>
                            <td>
                              <button className="btn" onClick={() => onSelect(row.id)}>
                                {displayMonth(row.month)}
                              </button>
                            </td>
                            <td className="num">{money(summary?.deposit ?? 0)}</td>
                            <td className="num">{money(summary?.income ?? 0)}</td>
                            <td className="num negative">{money(summary?.outgo ?? 0)}</td>
                            <td className="num">{money(summary?.investment ?? 0)}</td>
                            <td className="num">{money(summary?.account ?? 0)}</td>
                            <td>
                              <button
                                className="btn danger"
                                onClick={() => setPendingDeleteRow(row)}
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
              )}
            </section>
          );
        })}
      </div>
      <ConfirmDialog
        config={
          pendingDeleteRow
            ? {
                title: "データを削除",
                message: `${displayMonth(pendingDeleteRow.month)}のデータを削除しますか？`,
                confirmLabel: "削除",
                onConfirm: () => onDelete(pendingDeleteRow.id),
              }
            : null
        }
        onClose={() => setPendingDeleteRow(null)}
      />
    </div>
  );
}

export const MemoMonthlyTable = memo(MonthlyTable);

