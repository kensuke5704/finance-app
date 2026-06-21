"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import LoginGate from "../components/LoginGate";
import MomentumSelectionView, { type MomentumPickForSync } from "../components/finance/MomentumSelectionView";
import {
  clearFutureActuals,
  markFutureActualsCleared,
  shouldClearFutureActuals,
} from "../lib/futureActualsCleanup";
import type { FinanceProfile } from "../lib/financeStore";
import {
  defaultState,
  createPortableFinanceBackup,
  importFinanceBackup,
  loadFinanceState,
  newFundRecord,
  newFxTrade,
  newInvestmentRecord,
  newMonthlyRecord,
  newTickerHolding,
  persistLocalFinanceState,
  persistFinanceState,
} from "../lib/financeStore";
import { MOMENTUM_MONTHLY_ROWS, MOMENTUM_TICKERS } from "../lib/momentumData";
import { calculateMomentumSnapshot, DEFAULT_MOMENTUM_SETTINGS } from "../lib/momentumEngine";
import {
  refreshInvestmentState,
  syncCurrentFxAccount,
} from "../features/investments/services/refreshInvestmentState";
import type {
  FinanceState,
  FundRecord,
  FinanceSettings,
  FxRiskInput,
  FxTrade,
  InvestmentRecord,
  MonthlyRecord,
  TickerHolding,
} from "../types/finance";
import {
  BudgetSettingsView,
  FxView,
  MomentumView,
  SHORT_K_ACCOUNTS,
  ShortKAssetManagementView,
  ShortKView,
  inMonthRange,
  investmentsByAccounts,
  latestInvestmentRows,
  monthlyRows,
  todayString,
  uid,
} from "../components/finance/FinanceViews";

type MainTab = "short" | "asset" | "settings";
type AssetInnerTab = "asset" | "fund" | "active" | "fx";
type ActiveInnerTab = "composition" | "selection";

function serializeFinanceState(state: FinanceState) {
  return JSON.stringify(state);
}

function defaultMomentumPicksForSync(): MomentumPickForSync[] {
  return calculateMomentumSnapshot({
    rows: MOMENTUM_MONTHLY_ROWS,
    tickers: MOMENTUM_TICKERS,
    settings: DEFAULT_MOMENTUM_SETTINGS,
  }).picks.map((pick) => ({ symbol: pick.symbol, current: pick.current }));
}

function sameTickerRows(a: TickerHolding[], b: TickerHolding[]) {
  if (a.length !== b.length) return false;
  return a.every((row, index) => {
    const next = b[index];
    return (
      next &&
      row.id === next.id &&
      row.ticker === next.ticker &&
      row.price === next.price &&
      row.shares === next.shares
    );
  });
}

function syncActiveTickers(prev: FinanceState, picks: MomentumPickForSync[]) {
  const normalizedPicks = picks
    .slice(0, 10)
    .filter((pick) => pick.symbol)
    .map((pick) => ({ symbol: pick.symbol.trim().toUpperCase(), current: pick.current }));

  if (normalizedPicks.length === 0) return prev;

  const currentByTicker = new Map(
    prev.tickers.map((row) => [row.ticker.trim().toUpperCase(), row]),
  );

  const nextTickers = normalizedPicks.map((pick) => {
    const existing = currentByTicker.get(pick.symbol);
    if (existing) {
      return {
        ...existing,
        ticker: pick.symbol,
        price: pick.current || existing.price,
      };
    }

    return {
      ...newTickerHolding(),
      id: uid(),
      ticker: pick.symbol,
      price: pick.current || 0,
      shares: 1,
    };
  });

  return sameTickerRows(prev.tickers, nextTickers)
    ? prev
    : { ...prev, tickers: nextTickers };
}

export default function Page() {
  const defaultSelectedMonth = todayString().slice(0, 7);
  const [state, setState] = useState<FinanceState>(defaultState);
  const [activeProfile, setActiveProfile] = useState<FinanceProfile>("primary");
  const [mainTab, setMainTab] = useState<MainTab>("short");
  const [assetInnerTab, setAssetInnerTab] = useState<AssetInnerTab>("asset");
  const [activeInnerTab, setActiveInnerTab] = useState<ActiveInnerTab>("composition");
  const [momentumActivePicks, setMomentumActivePicks] = useState<MomentumPickForSync[]>(
    () => defaultMomentumPicksForSync(),
  );
  const [selectedMonthlyId, setSelectedMonthlyId] = useState(
    defaultState.monthly[0]?.id ?? "",
  );
  const [selectedShortKMonth, setSelectedShortKMonth] = useState(defaultSelectedMonth);
  const [selectedInvestmentId, setSelectedInvestmentId] = useState(
    defaultState.investments[0]?.id ?? "",
  );
  const [selectedFundId, setSelectedFundId] = useState(
    defaultState.funds[0]?.id ?? "",
  );
  const [selectedTickerId, setSelectedTickerId] = useState(
    defaultState.tickers[0]?.id ?? "",
  );
  const [selectedFxId, setSelectedFxId] = useState(
    defaultState.fxTrades[0]?.id ?? "",
  );
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);
  const [message, setMessage] = useState("");
  const messageTimerRef = useRef<number | null>(null);
  const savedSignatureRef = useRef(serializeFinanceState(defaultState));
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadedRef.current = false;
    setLoading(true);

    loadFinanceState(activeProfile)
      .then(async (loaded) => {
        const cleaned = activeProfile === "primary" && shouldClearFutureActuals()
          ? clearFutureActuals(loaded)
          : loaded;
        if (activeProfile === "primary" && cleaned !== loaded) {
          await persistFinanceState(cleaned, activeProfile);
          markFutureActualsCleared();
        }
        loaded = activeProfile === "primary"
          ? syncActiveTickers(cleaned, momentumActivePicks)
          : cleaned;
        if (cancelled) return;
        const signature = serializeFinanceState(loaded);
        savedSignatureRef.current = signature;
        setSaveStatus("saved");
        setLastSavedAt(new Date());
        setState(loaded);
        setSelectedMonthlyId(
          loaded.monthly.find((row) => inMonthRange(row.month))?.id ??
            loaded.monthly[0]?.id ??
            "",
        );
        setSelectedShortKMonth(defaultSelectedMonth);
        setSelectedInvestmentId(loaded.investments[0]?.id ?? "");
        setSelectedFundId(loaded.funds[0]?.id ?? "");
        setSelectedTickerId(loaded.tickers[0]?.id ?? "");
        setSelectedFxId(loaded.fxTrades[0]?.id ?? "");
      })
      .catch((error) =>
        !cancelled && setMessage(`データ取得に失敗しました: ${error.message}`),
      )
      .finally(() => {
        if (cancelled) return;
        loadedRef.current = true;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProfile, defaultSelectedMonth, momentumActivePicks]);

  useEffect(() => {
    if (!loadedRef.current || loading || activeProfile !== "primary") return;
    setState((prev) => syncActiveTickers(prev, momentumActivePicks));
  }, [activeProfile, loading, momentumActivePicks]);

  useEffect(() => {
    if (!loadedRef.current || loading || !state.tickers.length) return;
    setSelectedTickerId((current) => {
      if (state.tickers.some((row) => row.id === current)) return current;
      return state.tickers[0]?.id ?? current;
    });
  }, [loading, state.tickers]);

  useEffect(() => {
    if (!loadedRef.current || loading) return;
    const signature = serializeFinanceState(state);
    if (signature === savedSignatureRef.current) return;

    setSaveStatus("saving");
    const timer = window.setTimeout(async () => {
      try {
        await persistFinanceState(state, activeProfile);
        savedSignatureRef.current = signature;
        setSaveStatus("saved");
        setLastSavedAt(new Date());
      } catch {
        setSaveStatus("error");
        setMessage("自動バックアップに失敗しました。端末の空き容量をご確認ください");
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [activeProfile, state, loading]);

  useEffect(() => {
    return () => {
      if (messageTimerRef.current !== null) {
        window.clearTimeout(messageTimerRef.current);
      }
    };
  }, []);

  function setTemporaryMessage(nextMessage: string, duration = 3500) {
    if (messageTimerRef.current !== null) {
      window.clearTimeout(messageTimerRef.current);
    }
    setMessage(nextMessage);
    messageTimerRef.current = window.setTimeout(() => {
      setMessage((current) => (current === nextMessage ? "" : current));
      messageTimerRef.current = null;
    }, duration);
  }

  useEffect(() => {
    if (!loadedRef.current || loading) return;
    const flushLatestState = () => {
      persistLocalFinanceState(state, activeProfile);
      savedSignatureRef.current = serializeFinanceState(state);
    };
    window.addEventListener("pagehide", flushLatestState);
    return () => window.removeEventListener("pagehide", flushLatestState);
  }, [activeProfile, state, loading]);

  async function createBackupFile() {
    persistLocalFinanceState(state, activeProfile);
    const profiles = {
      primary: activeProfile === "primary" ? state : await loadFinanceState("primary"),
      secondary: activeProfile === "secondary" ? state : await loadFinanceState("secondary"),
    };
    const backup = createPortableFinanceBackup(profiles);
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    return new File([blob], `finance-planner-backup-${todayString()}.json`, {
      type: "application/json",
      lastModified: Date.now(),
    });
  }

  async function exportData() {
    const file = await createBackupFile();
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("バックアップを書き出しました");
  }

  async function shareData() {
    const file = await createBackupFile();
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
      await exportData();
      return;
    }

    try {
      await navigator.share({
        title: "Finance App バックアップ",
        text: "iCloud Driveへ保存するFinance Appのバックアップです。",
        files: [file],
      });
      setTemporaryMessage("共有画面を閉じました。保存先にiCloud Driveを選ぶと機種変更に備えられます");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("共有できなかったため、端末への保存をお試しください");
    }
  }

  async function restoreData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!window.confirm("2人分の現在データをバックアップ内容で置き換えます。よろしいですか？")) {
      return;
    }

    try {
      const profiles = importFinanceBackup(JSON.parse(await file.text()), activeProfile);
      const imported = profiles[activeProfile];
      const restored = activeProfile === "primary"
        ? syncActiveTickers(imported, momentumActivePicks)
        : imported;
      setState(restored);
      savedSignatureRef.current = serializeFinanceState(restored);
      setSaveStatus("saved");
      setLastSavedAt(new Date());
      setSelectedMonthlyId(restored.monthly[0]?.id ?? "");
      setSelectedInvestmentId(restored.investments[0]?.id ?? "");
      setSelectedFundId(restored.funds[0]?.id ?? "");
      setSelectedTickerId(restored.tickers[0]?.id ?? "");
      setSelectedFxId(restored.fxTrades[0]?.id ?? "");
      setMessage("2人分のバックアップを復元しました");
    } catch (error) {
      setMessage(
        `復元に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async function refreshAllInvestments() {
    const refreshed = await refreshInvestmentState(state);
    setState(refreshed);
  }

  function switchProfile() {
    if (loading) return;
    persistLocalFinanceState(state, activeProfile);
    savedSignatureRef.current = serializeFinanceState(state);
    setMessage("");
    setActiveProfile((current) => current === "primary" ? "secondary" : "primary");
  }

  function updateMonthly(row: MonthlyRecord) {
    setState((prev) => ({
      ...prev,
      monthly: prev.monthly.map((item) => (item.id === row.id ? row : item)),
    }));
  }

  function upsertShortKMonthly(month: string, patch: Partial<MonthlyRecord>) {
    setState((prev) => {
      const existing = prev.monthly.find((row) => row.month === month);
      if (existing) {
        return {
          ...prev,
          monthly: prev.monthly.map((row) =>
            row.id === existing.id ? { ...row, ...patch, month } : row,
          ),
        };
      }
      const row: MonthlyRecord = {
        ...newMonthlyRecord(),
        id: uid(),
        month,
        ...patch,
      };
      return { ...prev, monthly: [...prev.monthly, row] };
    });
  }

  function upsertShortKInvestment(
    month: string,
    account: string,
    patch: Partial<InvestmentRecord>,
  ) {
    setState((prev) => {
      const existing = prev.investments.find(
        (row) => row.month === month && row.account === account,
      );
      if (existing) {
        return {
          ...prev,
          investments: prev.investments.map((row) =>
            row.id === existing.id ? { ...row, ...patch, month, account } : row,
          ),
        };
      }
      const row: InvestmentRecord = {
        ...newInvestmentRecord(),
        id: uid(),
        month,
        account,
        ...patch,
      };
      return { ...prev, investments: [...prev.investments, row] };
    });
  }

  function updateInvestment(row: InvestmentRecord) {
    setState((prev) => ({
      ...prev,
      investments: prev.investments.map((item) =>
        item.id === row.id ? row : item,
      ),
    }));
  }

  function updateFund(row: FundRecord) {
    setState((prev) => ({
      ...prev,
      funds: prev.funds.map((item) => (item.id === row.id ? row : item)),
    }));
  }

  function updateTicker(row: TickerHolding) {
    setState((prev) => ({
      ...prev,
      tickers: prev.tickers.map((item) =>
        item.id === row.id ? row : item,
      ),
    }));
  }

  function updateFx(row: FxTrade) {
    setState((prev) =>
      syncCurrentFxAccount({
        ...prev,
        fxTrades: prev.fxTrades.map((item) => (item.id === row.id ? row : item)),
      }),
    );
  }

  function updateRisk(row: FxRiskInput) {
    setState((prev) => ({ ...prev, fxRisk: row }));
  }

  function updateSettings(settings: FinanceSettings) {
    setState((prev) => ({ ...prev, settings }));
  }

  const selectedMonthly =
    state.monthly.find((row) => row.id === selectedMonthlyId) ??
    state.monthly[0];
  const selectedFund =
    state.funds.find((row) => row.id === selectedFundId) ?? state.funds[0];
  const selectedTicker =
    state.tickers.find((row) => row.id === selectedTickerId) ??
    state.tickers[0];
  const selectedFx =
    state.fxTrades.find((row) => row.id === selectedFxId) ?? state.fxTrades[0];

  const shortKRows = investmentsByAccounts(state.investments, SHORT_K_ACCOUNTS);
  const sortedMonthly = monthlyRows(state.monthly);
  const risk = state.fxRisk;
  const swap = risk.swap_per_unit * risk.holding_days * (risk.units / 10000);
  const floatingLoss =
    (risk.contract_rate - risk.current_rate) * risk.units + swap;
  const requiredMargin =
    (risk.current_rate * risk.units) / Math.max(risk.leverage, 1);
  const shortage = Math.max(
    requiredMargin -
      risk.margin -
      risk.extra_margin +
      Math.max(-floatingLoss, 0),
    0,
  );
  const losscutRate =
    risk.contract_rate -
    (risk.margin + risk.extra_margin - requiredMargin + swap) /
      Math.max(risk.units, 1);
  const currentScreenTitle = useMemo(() => {
    if (mainTab === "short") return "ホーム";
    if (mainTab === "settings") return "設定";
    return {
      asset: "資産管理",
      fund: "投資信託",
      active: "アクティブ",
      fx: "FX",
    }[assetInnerTab];
  }, [assetInnerTab, mainTab]);

  if (loading) {
    return (
      <LoginGate>
        <main className="page">
          <div className="shell">
            <div className="notice" role="status" aria-live="polite">
              データを読み込み中です
            </div>
          </div>
        </main>
      </LoginGate>
    );
  }

  return (
    <LoginGate>
      <main className="page">
        <div className="shell">
          <header className="app-header">
            <div className={`app-header-identity ${activeProfile === "secondary" ? "secondary-profile" : ""}`}>
              <button
                type="button"
                className="profile-logo-button"
                aria-label={activeProfile === "primary" ? "もう1人の資産管理へ切り替える" : "元の資産管理へ戻る"}
                onClick={switchProfile}
              />
              <p className="app-eyebrow">Finance App</p>
              <h1 className="app-screen-title">{currentScreenTitle}</h1>
            </div>
            <div className={`auto-save-status ${saveStatus}`} role="status" aria-live="polite">
              <span className="auto-save-dot" aria-hidden="true" />
              {saveStatus === "saving"
                ? "自動保存中"
                : saveStatus === "error"
                  ? "保存エラー"
                  : lastSavedAt
                    ? `${lastSavedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} 保存済み`
                    : "自動保存"}
            </div>
          </header>

          {message && (
            <div className="notice" role="status" aria-live="polite">
              {message}
            </div>
          )}

          <nav className="tabs bottom-tabs" aria-label="メインメニュー">
            {[
              ["short", "ホーム"],
              ["asset", "資産"],
              ["settings", "設定"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={`tab ${mainTab === key ? "active" : ""}`}
                type="button"
                aria-current={mainTab === key ? "page" : undefined}
                onClick={() => setMainTab(key as MainTab)}
              >
                {label}
              </button>
            ))}
          </nav>

          {mainTab === "short" && selectedMonthly && (
            <ShortKView
              rows={state.monthly}
              sortedRows={sortedMonthly}
              selectedMonth={selectedShortKMonth}
              setSelectedMonth={setSelectedShortKMonth}
              upsertMonthly={upsertShortKMonthly}
              deleteMonthly={(id) =>
                setState((prev) => ({
                  ...prev,
                  monthly: prev.monthly.filter((row) => row.id !== id),
                }))
              }
              detailRows={state.investments}
              upsertInvestment={upsertShortKInvestment}
              annualReturnRates={state.settings.annualReturnRates}
            />
          )}

          {mainTab === "asset" && (
            <section className="stack">
              <div className="chart-tabs asset-inner-tabs" role="tablist" aria-label="資産管理メニュー">
                {[
                  ["asset", "資産管理"],
                  ["fund", "投資信託"],
                  ["active", "アクティブ"],
                  ["fx", "FX"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={`chart-tab ${assetInnerTab === key ? "active" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={assetInnerTab === key}
                    onClick={() => setAssetInnerTab(key as AssetInnerTab)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {assetInnerTab === "asset" && (
                <ShortKAssetManagementView
                  rows={state.monthly}
                  detailRows={state.investments}
                  selectedMonth={selectedShortKMonth}
                  setSelectedMonth={setSelectedShortKMonth}
                  upsertInvestment={upsertShortKInvestment}
                  annualReturnRates={state.settings.annualReturnRates}
                  onRefresh={refreshAllInvestments}
                />
              )}

              {assetInnerTab === "fund" && selectedFund && selectedTicker && (
                <MomentumView
                  title="投資信託"
                  state={state}
                  selectedFund={selectedFund}
                  selectedTicker={selectedTicker}
                  selectedFundId={selectedFundId}
                  selectedTickerId={selectedTickerId}
                  setSelectedFundId={setSelectedFundId}
                  setSelectedTickerId={setSelectedTickerId}
                  updateFund={updateFund}
                  updateTicker={updateTicker}
                  addFund={(patch) => {
                    const row = { ...newFundRecord(), id: uid(), ...patch };
                    setState((prev) => ({ ...prev, funds: [row, ...prev.funds] }));
                    setSelectedFundId(row.id);
                  }}
                  addTicker={(patch) => {
                    const row = { ...newTickerHolding(), id: uid(), shares: 1, ...patch };
                    setState((prev) => ({
                      ...prev,
                      tickers: [row, ...prev.tickers],
                    }));
                    setSelectedTickerId(row.id);
                  }}
                  deleteFund={(id) =>
                    setState((prev) => ({
                      ...prev,
                      funds: prev.funds.filter((row) => row.id !== id),
                    }))
                  }
                  deleteTicker={(id) =>
                    setState((prev) => ({
                      ...prev,
                      tickers: prev.tickers.filter((row) => row.id !== id),
                    }))
                  }
                  onRefreshInvestments={refreshAllInvestments}
                />
              )}

              {assetInnerTab === "active" && selectedTicker && selectedFund && (
                <section className="stack active-momentum-section">
                  <div className="chart-tabs active-product-tabs" role="tablist" aria-label="アクティブメニュー">
                    {[
                      ["composition", "構成銘柄"],
                      ["selection", "選定"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        className={`chart-tab ${activeInnerTab === key ? "active" : ""}`}
                        type="button"
                        role="tab"
                        aria-selected={activeInnerTab === key}
                        onClick={() => setActiveInnerTab(key as ActiveInnerTab)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {activeInnerTab === "composition" ? (
                    <MomentumView
                      title="アクティブ"
                      state={state}
                      selectedFund={selectedFund}
                      selectedTicker={selectedTicker}
                      selectedFundId={selectedFundId}
                      selectedTickerId={selectedTickerId}
                      setSelectedFundId={setSelectedFundId}
                      setSelectedTickerId={setSelectedTickerId}
                      updateFund={updateFund}
                      updateTicker={updateTicker}
                      addFund={(patch) => {
                        const row = { ...newFundRecord(), id: uid(), ...patch };
                        setState((prev) => ({ ...prev, funds: [row, ...prev.funds] }));
                        setSelectedFundId(row.id);
                      }}
                      addTicker={(patch) => {
                        const row = { ...newTickerHolding(), id: uid(), shares: 1, ...patch };
                        setState((prev) => ({
                          ...prev,
                          tickers: [row, ...prev.tickers],
                        }));
                        setSelectedTickerId(row.id);
                      }}
                      deleteFund={(id) =>
                        setState((prev) => ({
                          ...prev,
                          funds: prev.funds.filter((row) => row.id !== id),
                        }))
                      }
                      deleteTicker={(id) =>
                        setState((prev) => ({
                          ...prev,
                          tickers: prev.tickers.filter((row) => row.id !== id),
                        }))
                      }
                      onRefreshInvestments={refreshAllInvestments}
                    />
                  ) : (
                    <MomentumSelectionView
                      key={activeProfile}
                      profile={activeProfile}
                      onPicksChange={setMomentumActivePicks}
                    />
                  )}
                </section>
              )}

              {assetInnerTab === "fx" && selectedFx && (
                <FxView
                  rows={state.fxTrades}
                  selectedFx={selectedFx}
                  selectedFxId={selectedFxId}
                  setSelectedFxId={setSelectedFxId}
                  updateFx={updateFx}
                  addFx={(patch) => {
                    const row = { ...newFxTrade(), id: uid(), date: todayString(), ...patch };
                    setState((prev) =>
                      syncCurrentFxAccount({
                        ...prev,
                        fxTrades: [row, ...prev.fxTrades],
                      }),
                    );
                    setSelectedFxId(row.id);
                  }}
                  deleteFx={(id) =>
                    setState((prev) =>
                      syncCurrentFxAccount({
                        ...prev,
                        fxTrades: prev.fxTrades.filter((row) => row.id !== id),
                      }),
                    )
                  }
                  risk={risk}
                  updateRisk={updateRisk}
                  floatingLoss={floatingLoss}
                  requiredMargin={requiredMargin}
                  shortage={shortage}
                  losscutRate={losscutRate}
                />
              )}
            </section>
          )}

          {mainTab === "settings" && (
            <section className="stack">
              <BudgetSettingsView
                rows={state.monthly}
                settings={state.settings}
                updateSettings={updateSettings}
                selectedMonth={selectedShortKMonth}
                setSelectedMonth={setSelectedShortKMonth}
                upsertMonthly={upsertShortKMonthly}
              />
              <section className="settings-section data-backup-section">
                <div className="settings-section-heading">
                  <div>
                    <p className="settings-section-kicker">機種変更・復旧</p>
                    <h2 className="settings-section-title">データ管理</h2>
                  </div>
                  <span className="auto-backup-badge">変更時に自動バックアップ</span>
                </div>
                <p className="settings-section-note">
                  2人分の入力内容はこの端末に自動保存されます。機種変更前にiCloud Driveへバックアップファイルを保存してください。
                </p>
                <div className="data-backup-actions">
                  <button type="button" className="btn primary" onClick={shareData}>
                    iCloudへ保存
                  </button>
                  <button type="button" className="btn" onClick={exportData}>
                    端末へダウンロード
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => importInputRef.current?.click()}
                  >
                    バックアップを復元する
                  </button>
                  <input
                    ref={importInputRef}
                    className="visually-hidden"
                    type="file"
                    accept="application/json,.json"
                    onChange={restoreData}
                  />
                </div>
                <p className="icloud-help">
                  「iCloudへ保存」を押すと共有画面が開きます。「ファイルに保存」からiCloud Driveを選択してください。
                </p>
              </section>
            </section>
          )}

        </div>
      </main>
    </LoginGate>
  );
}

const SHORT_K_START = "2024-09";
const SHORT_K_END = "2060-12";
const SHORT_K_BUDGET_FALLBACK_MONTH = "2031-06";
const SHORT_K_BASE_MONTH = "2024-08";
const SHORT_K_BASE_CASH = 2359881;
const SHORT_K_INITIAL_INVESTMENT_PROFIT = 5371418;
const SHORT_K_CHART_TAB_STORAGE_KEY = "finance.shortK.chartTab";
const SHORT_K_MONTHLY_OPEN_YEARS_STORAGE_KEY = "finance.shortK.monthlyOpenYears";
