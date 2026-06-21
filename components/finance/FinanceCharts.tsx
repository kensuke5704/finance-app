"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { MonthlyRecord } from "../../types/finance";
import { money } from "./financeUtils";
import {
  SHORT_K_MONTHLY_OPEN_YEARS_STORAGE_KEY,
  ConfirmDialog,
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
  toolbar,
  fitToWidth = false,
  areaKey,
  chartHeight = 310,
  initialFocusIndex,
  initialVisiblePoints = 61,
  initialPointsBeforeFocus = 12,
  valueFormatter = money,
  yAxisFormatter = (value) =>
    `${Math.round(value / 10000).toLocaleString("ja-JP")}万`,
  yAxisWidth,
  xAxisMode = "monthly",
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
    axis?: "left" | "right";
  }[];
  showYAxis?: boolean;
  baselineZero?: boolean;
  storageKey?: string;
  toolbar?: React.ReactNode;
  fitToWidth?: boolean;
  areaKey?: string;
  chartHeight?: number;
  initialFocusIndex?: number;
  initialVisiblePoints?: number;
  initialPointsBeforeFocus?: number;
  valueFormatter?: (value: number) => string;
  yAxisFormatter?: (value: number) => string;
  yAxisWidth?: number;
  xAxisMode?: "monthly" | "daily";
}) {
  const visibleWidth = 346;
  const height = chartHeight;
  const hasRightAxis = showYAxis && series.some((item) => item.axis === "right");
  const axisWidth = showYAxis
    ? (yAxisWidth ?? (height <= 260 ? 48 : 58))
    : 0;
  const rightAxisWidth = hasRightAxis ? axisWidth : 0;
  const padLeft = showYAxis ? 8 : 24;
  const padRight = 18;
  const baseStep = 18;
  const scrollViewportWidth = Math.max(
    160,
    visibleWidth - axisWidth - rightAxisWidth,
  );
  const defaultPointCount = Math.min(
    Math.max(initialVisiblePoints, 2),
    Math.max(rows.length, 2),
  );
  const defaultZoom = fitToWidth
    ? 1
    : (scrollViewportWidth - padLeft - padRight) /
      Math.max((defaultPointCount - 1) * baseStep, 1);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const longPressRef = useRef<number | null>(null);
  const hasPositionedRef = useRef(false);
  const pointerRef = useRef<{
    id: number;
    startX: number;
    startScrollLeft: number;
    dragging: boolean;
  } | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [zoom, setZoom] = useState(defaultZoom);
  const [isPanning, setIsPanning] = useState(false);
  const [activePoint, setActivePoint] = useState<{
    index: number;
    label: string;
    x: number;
    items: { label: string; value: number; y: number; colorIndex: number }[];
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

  useEffect(() => {
    return () => {
      if (longPressRef.current !== null) {
        window.clearTimeout(longPressRef.current);
      }
    };
  }, []);

  const chartValue = (
    row: Record<string, string | number | undefined>,
    key: string,
  ) => {
    const value = row[key];
    return typeof value === "number" && Number.isFinite(value)
      ? value
      : undefined;
  };

  const padTop = height <= 200 ? 12 : 22;
  const padBottom = height <= 200 ? 28 : 42;
  const plotBottom = height - padBottom;
  const fittedStep =
    (scrollViewportWidth - padLeft - padRight) /
    Math.max(rows.length - 1, 1);
  const xStep = fitToWidth ? fittedStep * zoom : baseStep * zoom;
  const minZoomForFullView = Math.max(
    fitToWidth ? 1 : 0.02,
    fitToWidth
      ? 1
      : (scrollViewportWidth - padLeft - padRight) /
          Math.max(Math.max(rows.length - 1, 1) * baseStep, 1),
  );
  const width = Math.max(
    scrollViewportWidth,
    padLeft + padRight + Math.max(rows.length - 1, 1) * xStep,
  );

  useEffect(() => {
    const wrap = wrapRef.current;
    if (
      !wrap ||
      hasPositionedRef.current ||
      initialFocusIndex === undefined ||
      initialFocusIndex < 0
    ) {
      return;
    }
    hasPositionedRef.current = true;
    window.requestAnimationFrame(() => {
      const focusX = padLeft + initialFocusIndex * xStep;
      wrap.scrollLeft = Math.max(
        0,
        focusX - initialPointsBeforeFocus * xStep - padLeft,
      );
      setScrollLeft(wrap.scrollLeft);
    });
  }, [initialFocusIndex, initialPointsBeforeFocus, padLeft, xStep]);
  const visibleStart = Math.max(
    0,
    Math.floor((scrollLeft - padLeft) / Math.max(xStep, 1)) - 2,
  );
  const visibleCount = Math.ceil(scrollViewportWidth / Math.max(xStep, 1)) + 6;
  const visibleEnd = Math.min(rows.length, visibleStart + visibleCount);
  const visibleRows = rows.slice(
    visibleStart,
    Math.max(visibleEnd, visibleStart + 1),
  );
  const domainRows = visibleRows.length ? visibleRows : rows;
  const leftSeries = series.filter((item) => item.axis !== "right");
  const rightSeries = series.filter((item) => item.axis === "right");
  const valuesForSeries = (targetSeries: typeof series) =>
    domainRows.flatMap((row) =>
      targetSeries
      .map((item) => chartValue(row, item.key))
      .filter((value): value is number => value !== undefined),
    );
  const makeScale = (values: number[]) => {
    const rawMax = Math.max(...values, 1);
    const rawMin = baselineZero ? Math.min(...values, 0) : Math.min(...values);
    const roughRange = rawMax - rawMin || Math.max(Math.abs(rawMax), 100000);
    const magnitude = 10 ** Math.floor(Math.log10(Math.max(roughRange / 5, 1)));
    const normalized = roughRange / 5 / magnitude;
    const niceMultiplier =
      normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    const tickStep = showYAxis ? niceMultiplier * magnitude : 0;
    const min = showYAxis
      ? baselineZero
        ? 0
        : Math.floor((rawMin - tickStep * 0.35) / tickStep) * tickStep
      : rawMin;
    const max = showYAxis
      ? Math.max(
          min + tickStep,
          Math.ceil((rawMax + tickStep * 0.35) / tickStep) * tickStep,
        )
      : rawMax;
    const range = Math.max(max - min, 1);
    const y = (value: number) =>
      padTop + (1 - (value - min) / range) * (plotBottom - padTop);
    const ticks = showYAxis
      ? Array.from(
          { length: Math.floor((max - min) / tickStep) + 1 },
          (_, index) => min + index * tickStep,
        )
      : [max, min + range / 2, min];
    return { y, ticks };
  };
  const leftScale = makeScale(valuesForSeries(leftSeries));
  const rightScale = hasRightAxis
    ? makeScale(valuesForSeries(rightSeries))
    : leftScale;
  const x = (index: number) => padLeft + index * xStep;
  const yForSeries = (item: (typeof series)[number], value: number) =>
    item.axis === "right" ? rightScale.y(value) : leftScale.y(value);

  const firstYear = Number(String(rows[0]?.label ?? "0").slice(0, 4));
  const yearLabelInterval =
    xStep >= 7 ? 1 : xStep >= 3.6 ? 2 : xStep >= 2 ? 3 : 5;

  const syncScrollLeft = () => {
    if (!wrapRef.current) return;
    setScrollLeft(wrapRef.current.scrollLeft);
  };

  const setChartZoom = (nextZoom: number, centerRatio = 0.5) => {
    const clamped = Math.min(12, Math.max(minZoomForFullView, nextZoom));
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
      wrap.scrollLeft = Math.max(
        0,
        contentPoint * clamped - wrap.clientWidth * centerRatio,
      );
      setScrollLeft(wrap.scrollLeft);
    });
  };

  const pinchDistance = (touches: {
    [index: number]: { clientX: number; clientY: number };
  }) => {
    const first = touches[0];
    const second = touches[1];
    return Math.hypot(
      first.clientX - second.clientX,
      first.clientY - second.clientY,
    );
  };

  const buildActivePoint = (index: number) => {
    const row = rows[index];
    if (!row) return null;
    const items = series
      .map((item, sIndex) => {
        const value = chartValue(row, item.key);
        if (value === undefined) return null;
        return {
          label: item.label,
          value,
          y: yForSeries(item, value),
          colorIndex: item.colorIndex ?? sIndex % 6,
        };
      })
      .filter(
        (
          item,
        ): item is {
          label: string;
          value: number;
          y: number;
          colorIndex: number;
        } => item !== null,
      );
    if (!items.length) return null;
    return {
      index,
      label: String(row.label),
      x: x(index),
      items,
    };
  };

  const updateActivePointFromClientX = (clientX: number) => {
    const svg = wrapRef.current?.querySelector("svg.line-chart");
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / Math.max(rect.width, 1)) * width;
    const nextIndex = Math.min(
      rows.length - 1,
      Math.max(0, Math.round((svgX - padLeft) / Math.max(xStep, 1))),
    );
    setActivePoint(buildActivePoint(nextIndex));
  };

  const clearLongPressTimer = () => {
    if (longPressRef.current === null) return;
    window.clearTimeout(longPressRef.current);
    longPressRef.current = null;
  };

  const clearPointerState = () => {
    clearLongPressTimer();
    pointerRef.current = null;
    setIsPanning(false);
    setActivePoint(null);
  };

  return (
    <div className="panel chart-panel">
      <div className="panel-head">
        <div className="panel-title">{title}</div>
        {toolbar}
      </div>
      <div className="panel-body">
        <div
          className={`chart-scroll-shell ${showYAxis ? "has-fixed-y-axis" : ""} ${hasRightAxis ? "has-right-y-axis" : ""}`}
        >
          {showYAxis && (
            <svg
              className="fixed-y-axis-svg"
              viewBox={`0 0 ${axisWidth} ${height}`}
              preserveAspectRatio="none"
              style={{ width: axisWidth, height }}
              aria-hidden="true"
            >
              <line
                x1={axisWidth - 1}
                y1={padTop}
                x2={axisWidth - 1}
                y2={plotBottom}
                className="chart-axis"
              />
              {leftScale.ticks.map((tick) => {
                const gy = leftScale.y(tick);
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
                      {yAxisFormatter(tick)}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
          <div
            ref={wrapRef}
            className={`line-chart-wrap fixed-chart-wrap ${isPanning ? "is-panning" : ""}`}
            onScroll={syncScrollLeft}
            onWheel={(event) => {
              if (!event.ctrlKey && !event.metaKey) return;
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              const centerRatio =
                (event.clientX - rect.left) / Math.max(rect.width, 1);
              setChartZoom(
                zoom * (event.deltaY < 0 ? 1.12 : 0.88),
                centerRatio,
              );
            }}
            onTouchStart={(event) => {
              if (event.touches.length !== 2) return;
              clearPointerState();
              pinchRef.current = {
                distance: pinchDistance(event.touches),
                zoom,
              };
            }}
            onTouchMove={(event) => {
              if (event.touches.length !== 2 || !pinchRef.current) return;
              event.preventDefault();
              const nextDistance = pinchDistance(event.touches);
              const rect = event.currentTarget.getBoundingClientRect();
              const centerX =
                (event.touches[0].clientX + event.touches[1].clientX) / 2;
              const centerRatio =
                (centerX - rect.left) / Math.max(rect.width, 1);
              setChartZoom(
                pinchRef.current.zoom *
                  (nextDistance / pinchRef.current.distance),
                centerRatio,
              );
            }}
            onTouchEnd={() => {
              pinchRef.current = null;
            }}
          >
            <svg
              className="line-chart"
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="none"
              role="img"
              onPointerDown={(event) => {
                if (pinchRef.current) return;
                const wrap = wrapRef.current;
                pointerRef.current = {
                  id: event.pointerId,
                  startX: event.clientX,
                  startScrollLeft: wrap?.scrollLeft ?? 0,
                  dragging: false,
                };
                updateActivePointFromClientX(event.clientX);
                event.currentTarget.setPointerCapture?.(event.pointerId);
                clearLongPressTimer();
                longPressRef.current = window.setTimeout(() => {
                  if (!pointerRef.current) return;
                  pointerRef.current.dragging = true;
                  setIsPanning(true);
                  setActivePoint(null);
                }, 240);
              }}
              onPointerMove={(event) => {
                const pointer = pointerRef.current;
                const wrap = wrapRef.current;
                if (!pointer || pointer.id !== event.pointerId || pinchRef.current) return;
                const dx = event.clientX - pointer.startX;
                if (pointer.dragging) {
                  event.preventDefault();
                  if (wrap) {
                    wrap.scrollLeft = pointer.startScrollLeft - dx;
                    setScrollLeft(wrap.scrollLeft);
                  }
                  return;
                }
                if (Math.abs(dx) > 8) {
                  clearLongPressTimer();
                }
                updateActivePointFromClientX(event.clientX);
              }}
              onPointerUp={(event) => {
                event.currentTarget.releasePointerCapture?.(event.pointerId);
                clearLongPressTimer();
                const wasDragging = pointerRef.current?.dragging ?? false;
                pointerRef.current = null;
                setIsPanning(false);
                if (wasDragging) setActivePoint(null);
              }}
              onPointerCancel={clearPointerState}
              style={{ width, height, touchAction: "none" }}
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
              {leftScale.ticks.map((tick) => {
                const gy = leftScale.y(tick);
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
              {areaKey && (() => {
                const areaPoints = rows
                  .map((row, index) => {
                    const value = chartValue(row, areaKey);
                    const areaSeries = series.find(
                      (item) => item.key === areaKey,
                    );
                    return value === undefined
                      ? undefined
                      : `${x(index)},${yForSeries(areaSeries ?? series[0], value)}`;
                  })
                  .filter((point): point is string => Boolean(point));
                if (areaPoints.length < 2) return null;
                const firstX = areaPoints[0].split(",")[0];
                const lastX = areaPoints[areaPoints.length - 1].split(",")[0];
                return (
                  <polygon
                    points={`${firstX},${plotBottom} ${areaPoints.join(" ")} ${lastX},${plotBottom}`}
                    className="chart-area-fill"
                  />
                );
              })()}
              {series.map((item, sIndex) => {
                const points = rows
                  .map((row, index) => {
                    const value = chartValue(row, item.key);
                    return value === undefined
                      ? undefined
                      : `${x(index)},${yForSeries(item, value)}`;
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
                  return (
                    <circle
                      key={`${item.key}-${String(row.label)}`}
                      cx={x(index)}
                      cy={yForSeries(item, value)}
                      r={Math.max(10, Math.min(18, xStep * 0.8))}
                      className="chart-hit-point"
                    />
                  );
                }),
              )}
              {activePoint && (
                <g className="chart-point-popup">
                  <line
                    x1={activePoint.x}
                    y1={padTop}
                    x2={activePoint.x}
                    y2={plotBottom}
                    className="chart-crosshair-line"
                  />
                  {activePoint.items.map((item) => (
                    <circle
                      key={`${activePoint.label}-${item.label}`}
                      cx={activePoint.x}
                      cy={item.y}
                      r="4.5"
                      className={`chart-active-dot line-series-${item.colorIndex}`}
                    />
                  ))}
                  {(() => {
                    const popupWidth = Math.min(
                      220,
                      width - padLeft - padRight,
                    );
                    const rowHeight = 34;
                    const popupHeight =
                      34 + activePoint.items.length * rowHeight;
                    const popupX = Math.min(
                      Math.max(activePoint.x - popupWidth / 2, padLeft),
                      width - padRight - popupWidth,
                    );
                    const topY = Math.min(...activePoint.items.map((item) => item.y));
                    const popupY = Math.min(
                      Math.max(topY - popupHeight - 12, padTop),
                      plotBottom - popupHeight,
                    );
                    return (
                      <>
                        <rect
                          x={popupX}
                          y={popupY}
                          width={popupWidth}
                          height={popupHeight}
                          rx="10"
                        />
                        <text
                          x={popupX + popupWidth / 2}
                          y={popupY + 19}
                          textAnchor="middle"
                          className="chart-point-popup-title"
                        >
                          {activePoint.label}
                        </text>
                        {activePoint.items.map((item, index) => (
                          <g key={item.label}>
                            <circle
                              cx={popupX + 14}
                              cy={popupY + 36 + index * rowHeight}
                              r="3.5"
                              className={`chart-active-dot line-series-${item.colorIndex}`}
                            />
                            <text
                              x={popupX + 23}
                              y={popupY + 40 + index * rowHeight}
                              className="chart-point-popup-label"
                            >
                              {item.label}
                            </text>
                            <text
                              x={popupX + popupWidth - 10}
                              y={popupY + 55 + index * rowHeight}
                              textAnchor="end"
                              className="chart-point-popup-value"
                            >
                              {valueFormatter(item.value)}
                            </text>
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </g>
              )}
              {rows.map((row, index) => {
                const label = String(row.label);
                const year = Number(label.slice(0, 4));
                const monthNumber = Number(label.slice(5, 7));
                const dayNumber = Number(label.slice(8, 10));
                const isDaily = xAxisMode === "daily";
                const previousLabel =
                  index > 0 ? String(rows[index - 1]?.label ?? "") : "";
                const isMonthStart =
                  isDaily &&
                  (index === 0 || previousLabel.slice(0, 7) !== label.slice(0, 7));
                const isYearStart = isDaily
                  ? monthNumber === 1 && isMonthStart
                  : monthNumber === 1;
                const isQuarterStart =
                  monthNumber === 1 ||
                  monthNumber === 4 ||
                  monthNumber === 7 ||
                  monthNumber === 10;
                const dailyLabelInterval =
                  xStep >= 26 ? 7 : xStep >= 13 ? 14 : 0;
                const shouldShowDailyLabel =
                  isMonthStart ||
                  (dailyLabelInterval > 0 && index % dailyLabelInterval === 0);
                const tickMode =
                  xStep >= 34
                    ? "month"
                    : xStep >= 12
                      ? "quarter"
                      : "year";
                const shouldShowYear =
                  isYearStart &&
                  Number.isFinite(year) &&
                  Number.isFinite(firstYear) &&
                  (year - firstYear) % yearLabelInterval === 0;
                const shouldShowLabel =
                  isDaily
                    ? shouldShowDailyLabel
                    : tickMode === "month"
                      ? true
                      : tickMode === "quarter"
                        ? isQuarterStart
                        : shouldShowYear;
                const tickLabel =
                  isDaily
                    ? isYearStart
                      ? `${year}/${monthNumber}/${dayNumber}`
                      : `${monthNumber}/${dayNumber}`
                    : tickMode === "month"
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
                      y2={plotBottom + (isYearStart || isMonthStart ? 9 : 5)}
                      className={
                        isYearStart || isMonthStart
                          ? "chart-year-mark"
                          : "chart-month-mark"
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
          {hasRightAxis && (
            <svg
              className="fixed-y-axis-svg right"
              viewBox={`0 0 ${rightAxisWidth} ${height}`}
              preserveAspectRatio="none"
              style={{ width: rightAxisWidth, height }}
              aria-hidden="true"
            >
              <line
                x1="1"
                y1={padTop}
                x2="1"
                y2={plotBottom}
                className="chart-axis"
              />
              {rightScale.ticks.map((tick) => {
                const gy = rightScale.y(tick);
                return (
                  <g key={tick}>
                    <line
                      x1="1"
                      y1={gy}
                      x2="6"
                      y2={gy}
                      className="chart-axis"
                    />
                    <text x="9" y={gy + 5} className="chart-tick">
                      {yAxisFormatter(tick)}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
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
  const [pendingDeleteRow, setPendingDeleteRow] =
    useState<MonthlyRecord | null>(null);
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
    return Array.from(groups.entries()).map(([year, items]) => ({
      year,
      items,
    }));
  }, [rows]);
  const [openYears, setOpenYears] = useState<Record<string, boolean>>(() => {
    const saved = readLocalStorage(SHORT_K_MONTHLY_OPEN_YEARS_STORAGE_KEY);
    if (!saved) return {};
    try {
      const parsed = JSON.parse(saved) as Record<string, boolean>;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        return {};
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

  const updateOpenYears = (
    updater: (current: Record<string, boolean>) => Record<string, boolean>,
  ) => {
    setOpenYears((current) => {
      const next = updater(current);
      writeLocalStorage(
        SHORT_K_MONTHLY_OPEN_YEARS_STORAGE_KEY,
        JSON.stringify(next),
      );
      return next;
    });
  };

  const rowSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        deposit: number;
        income: number;
        outgo: number;
        investment: number;
      }
    >();
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
            parseShortKActuals(
              rows.find((item) => item.month === previousMonth(row.month)),
            ),
          ),
          investment: shortKInvestmentTotal(actuals),
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
                <span>
                  {open ? "▼" : "▶"} {year}年
                </span>
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
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row) => {
                        const summary = rowSummaries.get(row.id);
                        return (
                          <tr key={row.id}>
                            <td>
                              <button
                                className="btn"
                                onClick={() => onSelect(row.id)}
                              >
                                {displayMonth(row.month)}
                              </button>
                            </td>
                            <td className="num monthly-money-cell">
                              {money(summary?.deposit ?? 0)}
                            </td>
                            <td className="num monthly-money-cell">
                              {money(summary?.income ?? 0)}
                            </td>
                            <td className="num negative monthly-money-cell">
                              {money(summary?.outgo ?? 0)}
                            </td>
                            <td className="num monthly-money-cell">
                              {money(summary?.investment ?? 0)}
                            </td>
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
