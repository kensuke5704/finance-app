"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import LoginGate from "../components/LoginGate";
import {
  defaultState,
  createPortableFinanceBackup,
  importFinanceState,
  loadFinanceState,
  newFundRecord,
  newFxTrade,
  newInvestmentRecord,
  newMonthlyRecord,
  newTickerHolding,
  persistFinanceState,
} from "../lib/financeStore";
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
  latestByMonth,
  latestInvestmentRows,
  monthlyRows,
  todayString,
  totalInvestments,
  uid,
} from "../components/finance/FinanceViews";

type MainTab = "short" | "asset" | "settings";
type AssetInnerTab = "asset" | "fund" | "active" | "fx";

function serializeFinanceState(state: FinanceState) {
  return JSON.stringify(state);
}

export default function Page() {
  const defaultSelectedMonth = todayString().slice(0, 7);
  const [state, setState] = useState<FinanceState>(defaultState);
  const [mainTab, setMainTab] = useState<MainTab>("short");
  const [assetInnerTab, setAssetInnerTab] = useState<AssetInnerTab>("asset");
  const [inputOpen, setInputOpen] = useState(true);
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
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);
  const [message, setMessage] = useState("");
  const savedSignatureRef = useRef(serializeFinanceState(defaultState));
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFinanceState()
      .then((loaded) => {
        const signature = serializeFinanceState(loaded);
        savedSignatureRef.current = signature;
        setHasUnsavedChanges(false);
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
        setMessage(`データ取得に失敗しました: ${error.message}`),
      )
      .finally(() => {
        loadedRef.current = true;
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!loadedRef.current || loading) return;
    setHasUnsavedChanges(serializeFinanceState(state) !== savedSignatureRef.current);
  }, [state, loading]);

  async function save(nextState = state, silent = false) {
    if (!silent) {
      setSaving(true);
      setMessage("");
    }
    try {
      await persistFinanceState(nextState);
      savedSignatureRef.current = serializeFinanceState(nextState);
      setHasUnsavedChanges(false);
      if (!silent) setMessage("保存しました");
    } catch (error) {
      if (!silent) {
        setMessage(
          `保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } finally {
      if (!silent) setSaving(false);
    }
  }

  function createBackupFile() {
    const backup = createPortableFinanceBackup(state);
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    return new File([blob], `finance-planner-backup-${todayString()}.json`, {
      type: "application/json",
      lastModified: Date.now(),
    });
  }

  function exportData() {
    const file = createBackupFile();
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
    const file = createBackupFile();
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
      exportData();
      return;
    }

    try {
      await navigator.share({
        title: "Finance Planner バックアップ",
        text: "機種変更用のFinance Plannerバックアップです。",
        files: [file],
      });
      setMessage("バックアップを共有しました");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("共有できなかったため、端末への保存をお試しください");
    }
  }

  async function restoreData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!window.confirm("現在のデータをバックアップ内容で置き換えます。よろしいですか？")) {
      return;
    }

    try {
      const restored = importFinanceState(JSON.parse(await file.text()));
      setState(restored);
      savedSignatureRef.current = serializeFinanceState(restored);
      setHasUnsavedChanges(false);
      setSelectedMonthlyId(restored.monthly[0]?.id ?? "");
      setSelectedInvestmentId(restored.investments[0]?.id ?? "");
      setSelectedFundId(restored.funds[0]?.id ?? "");
      setSelectedTickerId(restored.tickers[0]?.id ?? "");
      setSelectedFxId(restored.fxTrades[0]?.id ?? "");
      setMessage("バックアップを復元しました");
    } catch (error) {
      setMessage(
        `復元に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
    setState((prev) => ({
      ...prev,
      fxTrades: prev.fxTrades.map((item) => (item.id === row.id ? row : item)),
    }));
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
  const selectedInvestment =
    state.investments.find((row) => row.id === selectedInvestmentId) ??
    state.investments[0];
  const selectedFund =
    state.funds.find((row) => row.id === selectedFundId) ?? state.funds[0];
  const selectedTicker =
    state.tickers.find((row) => row.id === selectedTickerId) ??
    state.tickers[0];
  const selectedFx =
    state.fxTrades.find((row) => row.id === selectedFxId) ?? state.fxTrades[0];

  const shortKRows = investmentsByAccounts(state.investments, SHORT_K_ACCOUNTS);
  const latestMonthly = latestByMonth(state.monthly);
  const sortedMonthly = monthlyRows(state.monthly);
  const shortKDetailRows = latestInvestmentRows(shortKRows);
  const shortKInvestmentTotal = totalInvestments(shortKDetailRows);
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
          {message && (
            <div className="notice" role="status" aria-live="polite">
              {message}
            </div>
          )}

          <nav className="tabs bottom-tabs" aria-label="メインメニュー">
            {[
              ["short", "ホーム"],
              ["asset", "資産管理"],
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
                />
              )}

              {(assetInnerTab === "fund" || assetInnerTab === "active") && selectedFund && selectedTicker && (
                <MomentumView
                  title={assetInnerTab === "fund" ? "投資信託" : "アクティブ"}
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
                />
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
                    setState((prev) => ({
                      ...prev,
                      fxTrades: [row, ...prev.fxTrades],
                    }));
                    setSelectedFxId(row.id);
                  }}
                  deleteFx={(id) =>
                    setState((prev) => ({
                      ...prev,
                      fxTrades: prev.fxTrades.filter((row) => row.id !== id),
                    }))
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
                <h2 className="settings-section-title">データのバックアップ</h2>
                <p className="settings-section-note">
                  機種変更前にバックアップをファイルへ保存し、新しいスマホで復元してください。iCloud Drive、Google Drive、AirDropなどへ共有できます。
                </p>
                <div className="data-backup-actions">
                  <button type="button" className="btn primary" onClick={shareData}>
                    スマホに保存・共有
                  </button>
                  <button type="button" className="btn" onClick={exportData}>
                    ファイルをダウンロード
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
              </section>
            </section>
          )}

          {hasUnsavedChanges && (
            <div className="confirm-save-bar" role="status" aria-live="polite">
              <span>変更内容をまだ保存していません</span>
              <button
                type="button"
                className="btn primary confirm-save-button"
                onClick={() => save(state)}
                disabled={saving}
              >
                {saving ? "保存中..." : "確定して保存"}
              </button>
            </div>
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
