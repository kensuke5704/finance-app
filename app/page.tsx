"use client";

import { useEffect, useMemo, useState } from "react";
import {
  defaultState,
  fundNames,
  investmentAccounts,
  loadFinanceState,
  newFundRecord,
  newFxTrade,
  newInvestmentRecord,
  newMonthlyRecord,
  newTickerHolding,
  persistFinanceState,
} from "../lib/financeStore";
import type { FinanceState, FundRecord, FxRiskInput, FxTrade, InvestmentRecord, MonthlyRecord, TickerHolding } from "../types/finance";
import LoginGate from "../components/LoginGate";

type Tab = "monthly" | "investment" | "funds" | "fx" | "risk";

const yen = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("ja-JP", { style: "percent", maximumFractionDigits: 2 });

function n(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return `${yen.format(Math.round(value))}円`;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function MonthInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <input className="input" type="month" value={value} onChange={(e) => onChange(e.target.value)} />;
}

function NumberInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <input className="input" type="number" value={value} onChange={(e) => onChange(n(e.target.value))} />;
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <input className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export default function Page() {
  const [state, setState] = useState<FinanceState>(defaultState);
  const [tab, setTab] = useState<Tab>("monthly");
  const [selectedMonthlyId, setSelectedMonthlyId] = useState(defaultState.monthly[0]?.id ?? "");
  const [selectedInvestmentId, setSelectedInvestmentId] = useState(defaultState.investments[0]?.id ?? "");
  const [selectedFundId, setSelectedFundId] = useState(defaultState.funds[0]?.id ?? "");
  const [selectedTickerId, setSelectedTickerId] = useState(defaultState.tickers[0]?.id ?? "");
  const [selectedFxId, setSelectedFxId] = useState(defaultState.fxTrades[0]?.id ?? "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadFinanceState()
      .then((loaded) => {
        setState(loaded);
        setSelectedMonthlyId(loaded.monthly[0]?.id ?? "");
        setSelectedInvestmentId(loaded.investments[0]?.id ?? "");
        setSelectedFundId(loaded.funds[0]?.id ?? "");
        setSelectedTickerId(loaded.tickers[0]?.id ?? "");
        setSelectedFxId(loaded.fxTrades[0]?.id ?? "");
      })
      .catch((error) => setMessage(`データ取得に失敗しました: ${error.message}`))
      .finally(() => setLoading(false));
  }, []);

  async function save(nextState = state) {
    setSaving(true);
    setMessage("");
    try {
      await persistFinanceState(nextState);
      setMessage("保存しました");
    } catch (error) {
      setMessage(`保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSaving(false);
    }
  }

  const summary = useMemo(() => {
    const latestMonthly = [...state.monthly].sort((a, b) => b.month.localeCompare(a.month))[0];
    const monthlyTotal = state.monthly.reduce(
      (acc, row) => {
        const outgoActual = row.outgo_cash + row.outgo_card + row.outgo_other;
        acc.income += row.income_actual || row.income_budget;
        acc.outgo += outgoActual || row.outgo_budget;
        acc.invest += row.invest_actual || row.invest_budget;
        return acc;
      },
      { income: 0, outgo: 0, invest: 0 },
    );
    const investmentActual = state.investments.reduce((sum, row) => sum + row.actual_balance, 0);
    const investmentPredicted = state.investments.reduce((sum, row) => sum + row.predicted_balance, 0);
    const fundValue = state.funds.reduce((sum, row) => sum + (row.price * row.units) / 10000, 0);
    const tickerValue = state.tickers.reduce((sum, row) => sum + row.price * row.shares, 0);
    const fxTotal = state.fxTrades.reduce((sum, row) => sum + row.result, 0);
    const total = (latestMonthly?.cash_actual || latestMonthly?.cash_prediction || 0) + (investmentActual || investmentPredicted) + fundValue + tickerValue;
    return { latestMonthly, monthlyTotal, investmentActual, investmentPredicted, fundValue, tickerValue, fxTotal, total };
  }, [state]);

  function updateMonthly(row: MonthlyRecord) {
    setState((prev) => ({ ...prev, monthly: prev.monthly.map((item) => (item.id === row.id ? row : item)) }));
  }
  function updateInvestment(row: InvestmentRecord) {
    setState((prev) => ({ ...prev, investments: prev.investments.map((item) => (item.id === row.id ? row : item)) }));
  }
  function updateFund(row: FundRecord) {
    setState((prev) => ({ ...prev, funds: prev.funds.map((item) => (item.id === row.id ? row : item)) }));
  }
  function updateTicker(row: TickerHolding) {
    setState((prev) => ({ ...prev, tickers: prev.tickers.map((item) => (item.id === row.id ? row : item)) }));
  }
  function updateFx(row: FxTrade) {
    setState((prev) => ({ ...prev, fxTrades: prev.fxTrades.map((item) => (item.id === row.id ? row : item)) }));
  }
  function updateRisk(row: FxRiskInput) {
    setState((prev) => ({ ...prev, fxRisk: row }));
  }

  const selectedMonthly = state.monthly.find((row) => row.id === selectedMonthlyId) ?? state.monthly[0];
  const selectedInvestment = state.investments.find((row) => row.id === selectedInvestmentId) ?? state.investments[0];
  const selectedFund = state.funds.find((row) => row.id === selectedFundId) ?? state.funds[0];
  const selectedTicker = state.tickers.find((row) => row.id === selectedTickerId) ?? state.tickers[0];
  const selectedFx = state.fxTrades.find((row) => row.id === selectedFxId) ?? state.fxTrades[0];

  const risk = state.fxRisk;
  const swap = risk.swap_per_unit * risk.holding_days * (risk.units / 10000);
  const floatingLoss = (risk.contract_rate - risk.current_rate) * risk.units + swap;
  const requiredMargin = (risk.current_rate * risk.units) / Math.max(risk.leverage, 1);
  const shortage = Math.max(requiredMargin - risk.margin - risk.extra_margin + Math.max(-floatingLoss, 0), 0);
  const losscutRate = risk.contract_rate - (risk.margin + risk.extra_margin - requiredMargin + swap) / Math.max(risk.units, 1);

  return (
    <LoginGate>
      <main className="page">
      <div className="shell">
        <header className="header">
          <div>
            <div className="title">Finance Planner</div>
            <div className="subtitle">Finance.xlsmの資産計画・投資・ファンド・FX・ロスカット計算をPC向けWebアプリ化</div>
          </div>
          <div className="actions">
            <button className="btn" onClick={() => window.location.reload()}>再読み込み</button>
            <button className="btn primary" disabled={saving || loading} onClick={() => save()}>{saving ? "保存中" : "保存"}</button>
          </div>
        </header>

        {message && <div className="notice">{message}</div>}

        <section className="kpis">
          <div className="kpi"><div className="kpi-label">推定総資産</div><div className="kpi-value">{money(summary.total)}</div></div>
          <div className="kpi"><div className="kpi-label">現金 / 予測</div><div className="kpi-value">{money(summary.latestMonthly?.cash_actual || summary.latestMonthly?.cash_prediction || 0)}</div></div>
          <div className="kpi"><div className="kpi-label">投資口座</div><div className="kpi-value">{money(summary.investmentActual || summary.investmentPredicted)}</div></div>
          <div className="kpi"><div className="kpi-label">投信・個別株</div><div className="kpi-value">{money(summary.fundValue + summary.tickerValue)}</div></div>
          <div className="kpi"><div className="kpi-label">FX累計損益</div><div className={`kpi-value ${summary.fxTotal < 0 ? "negative" : "positive"}`}>{money(summary.fxTotal)}</div></div>
        </section>

        <nav className="tabs">
          {[
            ["monthly", "月次資産計画"],
            ["investment", "投資口座"],
            ["funds", "ファンド・銘柄"],
            ["fx", "FX損益"],
            ["risk", "ロスカット計算"],
          ].map(([key, label]) => (
            <button key={key} className={`tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key as Tab)}>{label}</button>
          ))}
        </nav>

        {tab === "monthly" && selectedMonthly && (
          <section className="grid">
            <div className="panel">
              <div className="panel-head"><div className="panel-title">月次入力</div><button className="btn" onClick={() => {
                const row = { ...newMonthlyRecord(), id: uid() };
                const next = { ...state, monthly: [row, ...state.monthly] };
                setState(next); setSelectedMonthlyId(row.id);
              }}>追加</button></div>
              <div className="panel-body">
                <div className="field"><span className="label">編集する月</span><select className="input" value={selectedMonthly.id} onChange={(e) => setSelectedMonthlyId(e.target.value)}>{state.monthly.map((row) => <option key={row.id} value={row.id}>{row.month}</option>)}</select></div>
                <div className="form-grid">
                  <div className="field"><span className="label">月</span><MonthInput value={selectedMonthly.month} onChange={(month) => updateMonthly({ ...selectedMonthly, month })} /></div>
                  <div className="field"><span className="label">年齢</span><NumberInput value={selectedMonthly.age} onChange={(age) => updateMonthly({ ...selectedMonthly, age })} /></div>
                  <div className="field"><span className="label">現金 予測</span><NumberInput value={selectedMonthly.cash_prediction} onChange={(cash_prediction) => updateMonthly({ ...selectedMonthly, cash_prediction })} /></div>
                  <div className="field"><span className="label">現金 実績</span><NumberInput value={selectedMonthly.cash_actual} onChange={(cash_actual) => updateMonthly({ ...selectedMonthly, cash_actual })} /></div>
                  <div className="field"><span className="label">収入 予算</span><NumberInput value={selectedMonthly.income_budget} onChange={(income_budget) => updateMonthly({ ...selectedMonthly, income_budget })} /></div>
                  <div className="field"><span className="label">収入 実績</span><NumberInput value={selectedMonthly.income_actual} onChange={(income_actual) => updateMonthly({ ...selectedMonthly, income_actual })} /></div>
                  <div className="field"><span className="label">支出 予算</span><NumberInput value={selectedMonthly.outgo_budget} onChange={(outgo_budget) => updateMonthly({ ...selectedMonthly, outgo_budget })} /></div>
                  <div className="field"><span className="label">支出 現金</span><NumberInput value={selectedMonthly.outgo_cash} onChange={(outgo_cash) => updateMonthly({ ...selectedMonthly, outgo_cash })} /></div>
                  <div className="field"><span className="label">支出 カード</span><NumberInput value={selectedMonthly.outgo_card} onChange={(outgo_card) => updateMonthly({ ...selectedMonthly, outgo_card })} /></div>
                  <div className="field"><span className="label">支出 その他</span><NumberInput value={selectedMonthly.outgo_other} onChange={(outgo_other) => updateMonthly({ ...selectedMonthly, outgo_other })} /></div>
                  <div className="field"><span className="label">投資 予算</span><NumberInput value={selectedMonthly.invest_budget} onChange={(invest_budget) => updateMonthly({ ...selectedMonthly, invest_budget })} /></div>
                  <div className="field"><span className="label">投資 実績</span><NumberInput value={selectedMonthly.invest_actual} onChange={(invest_actual) => updateMonthly({ ...selectedMonthly, invest_actual })} /></div>
                  <div className="field"><span className="label">USD 元本</span><NumberInput value={selectedMonthly.usd_capital} onChange={(usd_capital) => updateMonthly({ ...selectedMonthly, usd_capital })} /></div>
                  <div className="field"><span className="label">USD 実績</span><NumberInput value={selectedMonthly.usd_actual} onChange={(usd_actual) => updateMonthly({ ...selectedMonthly, usd_actual })} /></div>
                  <div className="field full"><span className="label">メモ</span><TextInput value={selectedMonthly.note ?? ""} onChange={(note) => updateMonthly({ ...selectedMonthly, note })} /></div>
                </div>
              </div>
            </div>
            <MonthlyTable rows={state.monthly} onSelect={setSelectedMonthlyId} onDelete={(id) => setState((prev) => ({ ...prev, monthly: prev.monthly.filter((row) => row.id !== id) }))} />
          </section>
        )}

        {tab === "investment" && selectedInvestment && (
          <section className="grid">
            <div className="panel"><div className="panel-head"><div className="panel-title">投資口座入力</div><button className="btn" onClick={() => { const row = { ...newInvestmentRecord(), id: uid() }; setState((prev) => ({ ...prev, investments: [row, ...prev.investments] })); setSelectedInvestmentId(row.id); }}>追加</button></div>
              <div className="panel-body">
                <div className="field"><span className="label">編集行</span><select className="input" value={selectedInvestment.id} onChange={(e) => setSelectedInvestmentId(e.target.value)}>{state.investments.map((row) => <option key={row.id} value={row.id}>{row.month} / {row.account}</option>)}</select></div>
                <div className="form-grid">
                  <div className="field"><span className="label">月</span><MonthInput value={selectedInvestment.month} onChange={(month) => updateInvestment({ ...selectedInvestment, month })} /></div>
                  <div className="field"><span className="label">口座</span><select className="input" value={selectedInvestment.account} onChange={(e) => updateInvestment({ ...selectedInvestment, account: e.target.value })}>{investmentAccounts.map((name) => <option key={name}>{name}</option>)}</select></div>
                  <div className="field"><span className="label">入金</span><NumberInput value={selectedInvestment.deposit} onChange={(deposit) => updateInvestment({ ...selectedInvestment, deposit })} /></div>
                  <div className="field"><span className="label">出金</span><NumberInput value={selectedInvestment.withdrawal} onChange={(withdrawal) => updateInvestment({ ...selectedInvestment, withdrawal })} /></div>
                  <div className="field"><span className="label">元本</span><NumberInput value={selectedInvestment.capital} onChange={(capital) => updateInvestment({ ...selectedInvestment, capital })} /></div>
                  <div className="field"><span className="label">予想残高</span><NumberInput value={selectedInvestment.predicted_balance} onChange={(predicted_balance) => updateInvestment({ ...selectedInvestment, predicted_balance })} /></div>
                  <div className="field"><span className="label">実績残高</span><NumberInput value={selectedInvestment.actual_balance} onChange={(actual_balance) => updateInvestment({ ...selectedInvestment, actual_balance })} /></div>
                  <div className="field"><span className="label">月次想定利回り</span><NumberInput value={selectedInvestment.monthly_return_rate} onChange={(monthly_return_rate) => updateInvestment({ ...selectedInvestment, monthly_return_rate })} /></div>
                </div>
              </div>
            </div>
            <InvestmentTable rows={state.investments} onSelect={setSelectedInvestmentId} onDelete={(id) => setState((prev) => ({ ...prev, investments: prev.investments.filter((row) => row.id !== id) }))} />
          </section>
        )}

        {tab === "funds" && selectedFund && selectedTicker && (
          <section className="two-col">
            <div className="grid" style={{ gridTemplateColumns: "320px 1fr" }}>
              <div className="panel"><div className="panel-head"><div className="panel-title">投信入力</div><button className="btn" onClick={() => { const row = { ...newFundRecord(), id: uid() }; setState((prev) => ({ ...prev, funds: [row, ...prev.funds] })); setSelectedFundId(row.id); }}>追加</button></div>
                <div className="panel-body">
                  <div className="field"><span className="label">編集行</span><select className="input" value={selectedFund.id} onChange={(e) => setSelectedFundId(e.target.value)}>{state.funds.map((row) => <option key={row.id} value={row.id}>{row.date} / {row.name}</option>)}</select></div>
                  <div className="field"><span className="label">日付</span><input className="input" type="date" value={selectedFund.date} onChange={(e) => updateFund({ ...selectedFund, date: e.target.value })} /></div>
                  <div className="field"><span className="label">ファンド</span><select className="input" value={selectedFund.name} onChange={(e) => updateFund({ ...selectedFund, name: e.target.value })}>{fundNames.map((name) => <option key={name}>{name}</option>)}</select></div>
                  <div className="field"><span className="label">基準価額</span><NumberInput value={selectedFund.price} onChange={(price) => updateFund({ ...selectedFund, price })} /></div>
                  <div className="field"><span className="label">前日差</span><NumberInput value={selectedFund.change_amount} onChange={(change_amount) => updateFund({ ...selectedFund, change_amount })} /></div>
                  <div className="field"><span className="label">純資産 百万円</span><NumberInput value={selectedFund.nav_million} onChange={(nav_million) => updateFund({ ...selectedFund, nav_million })} /></div>
                  <div className="field"><span className="label">保有数</span><NumberInput value={selectedFund.units} onChange={(units) => updateFund({ ...selectedFund, units })} /></div>
                </div>
              </div>
              <FundTable rows={state.funds} onSelect={setSelectedFundId} onDelete={(id) => setState((prev) => ({ ...prev, funds: prev.funds.filter((row) => row.id !== id) }))} />
            </div>
            <div className="grid" style={{ gridTemplateColumns: "300px 1fr" }}>
              <div className="panel"><div className="panel-head"><div className="panel-title">個別銘柄</div><button className="btn" onClick={() => { const row = { ...newTickerHolding(), id: uid() }; setState((prev) => ({ ...prev, tickers: [row, ...prev.tickers] })); setSelectedTickerId(row.id); }}>追加</button></div>
                <div className="panel-body">
                  <div className="field"><span className="label">編集行</span><select className="input" value={selectedTicker.id} onChange={(e) => setSelectedTickerId(e.target.value)}>{state.tickers.map((row) => <option key={row.id} value={row.id}>{row.ticker || "未設定"}</option>)}</select></div>
                  <div className="field"><span className="label">Ticker</span><TextInput value={selectedTicker.ticker} onChange={(ticker) => updateTicker({ ...selectedTicker, ticker: ticker.toUpperCase() })} /></div>
                  <div className="field"><span className="label">終値</span><NumberInput value={selectedTicker.price} onChange={(price) => updateTicker({ ...selectedTicker, price })} /></div>
                  <div className="field"><span className="label">保有数</span><NumberInput value={selectedTicker.shares} onChange={(shares) => updateTicker({ ...selectedTicker, shares })} /></div>
                </div>
              </div>
              <TickerTable rows={state.tickers} onSelect={setSelectedTickerId} onDelete={(id) => setState((prev) => ({ ...prev, tickers: prev.tickers.filter((row) => row.id !== id) }))} />
            </div>
          </section>
        )}

        {tab === "fx" && selectedFx && (
          <section className="grid">
            <div className="panel"><div className="panel-head"><div className="panel-title">FX損益入力</div><button className="btn" onClick={() => { const row = { ...newFxTrade(), id: uid() }; setState((prev) => ({ ...prev, fxTrades: [row, ...prev.fxTrades] })); setSelectedFxId(row.id); }}>追加</button></div>
              <div className="panel-body">
                <div className="field"><span className="label">編集行</span><select className="input" value={selectedFx.id} onChange={(e) => setSelectedFxId(e.target.value)}>{state.fxTrades.map((row) => <option key={row.id} value={row.id}>{row.date} / {money(row.result)}</option>)}</select></div>
                <div className="field"><span className="label">日付</span><input className="input" type="date" value={selectedFx.date} onChange={(e) => updateFx({ ...selectedFx, date: e.target.value })} /></div>
                <div className="field"><span className="label">損益</span><NumberInput value={selectedFx.result} onChange={(result) => updateFx({ ...selectedFx, result })} /></div>
                <div className="field"><span className="label">メモ</span><TextInput value={selectedFx.memo ?? ""} onChange={(memo) => updateFx({ ...selectedFx, memo })} /></div>
              </div>
            </div>
            <FxTable rows={state.fxTrades} onSelect={setSelectedFxId} onDelete={(id) => setState((prev) => ({ ...prev, fxTrades: prev.fxTrades.filter((row) => row.id !== id) }))} />
          </section>
        )}

        {tab === "risk" && (
          <section className="grid">
            <div className="panel"><div className="panel-head"><div className="panel-title">ロスカット条件</div></div>
              <div className="panel-body">
                <div className="form-grid">
                  <div className="field"><span className="label">保証金</span><NumberInput value={risk.margin} onChange={(margin) => updateRisk({ ...risk, margin })} /></div>
                  <div className="field"><span className="label">通貨数</span><NumberInput value={risk.units} onChange={(units) => updateRisk({ ...risk, units })} /></div>
                  <div className="field"><span className="label">約定価格</span><NumberInput value={risk.contract_rate} onChange={(contract_rate) => updateRisk({ ...risk, contract_rate })} /></div>
                  <div className="field"><span className="label">現在レート</span><NumberInput value={risk.current_rate} onChange={(current_rate) => updateRisk({ ...risk, current_rate })} /></div>
                  <div className="field"><span className="label">レバレッジ</span><NumberInput value={risk.leverage} onChange={(leverage) => updateRisk({ ...risk, leverage })} /></div>
                  <div className="field"><span className="label">swap単位</span><NumberInput value={risk.swap_per_unit} onChange={(swap_per_unit) => updateRisk({ ...risk, swap_per_unit })} /></div>
                  <div className="field"><span className="label">保有日数</span><NumberInput value={risk.holding_days} onChange={(holding_days) => updateRisk({ ...risk, holding_days })} /></div>
                  <div className="field"><span className="label">追加保証金</span><NumberInput value={risk.extra_margin} onChange={(extra_margin) => updateRisk({ ...risk, extra_margin })} /></div>
                </div>
              </div>
            </div>
            <div className="panel"><div className="panel-head"><div className="panel-title">計算結果</div><span className="badge">Finance.xlsm loss相当</span></div>
              <div className="panel-body">
                <section className="kpis" style={{ gridTemplateColumns: "repeat(2, 1fr)", marginBottom: 0 }}>
                  <div className="kpi"><div className="kpi-label">含み損益</div><div className={`kpi-value ${floatingLoss < 0 ? "negative" : "positive"}`}>{money(floatingLoss)}</div></div>
                  <div className="kpi"><div className="kpi-label">必要保証金</div><div className="kpi-value">{money(requiredMargin)}</div></div>
                  <div className="kpi"><div className="kpi-label">不足保証金</div><div className={`kpi-value ${shortage > 0 ? "negative" : "positive"}`}>{money(shortage)}</div></div>
                  <div className="kpi"><div className="kpi-label">概算ロスカット水準</div><div className="kpi-value">{losscutRate.toFixed(3)}</div></div>
                </section>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
    </LoginGate>
  );
}

function MonthlyTable({ rows, onSelect, onDelete }: { rows: MonthlyRecord[]; onSelect: (id: string) => void; onDelete: (id: string) => void }) {
  return <div className="panel"><div className="panel-head"><div className="panel-title">月次一覧</div><span className="badge">予算 / 実績 / 差額</span></div><div className="table-wrap"><table><thead><tr><th>月</th><th className="num">現金予測</th><th className="num">現金実績</th><th className="num">収入</th><th className="num">支出</th><th className="num">投資</th><th className="num">総額予測</th><th className="num">差額</th><th></th></tr></thead><tbody>{[...rows].sort((a,b)=>b.month.localeCompare(a.month)).map((row) => {
    const outgo = row.outgo_cash + row.outgo_card + row.outgo_other;
    const actualOutgo = outgo || row.outgo_budget;
    const predictedTotal = row.cash_prediction + row.invest_budget + row.usd_capital;
    const actualTotal = (row.cash_actual || row.cash_prediction) + (row.invest_actual || row.invest_budget) + (row.usd_actual || row.usd_capital);
    const diff = actualTotal - predictedTotal;
    return <tr key={row.id}><td><button className="btn" onClick={() => onSelect(row.id)}>{row.month}</button></td><td className="num">{money(row.cash_prediction)}</td><td className="num">{money(row.cash_actual)}</td><td className="num">{money(row.income_actual || row.income_budget)}</td><td className="num negative">{money(actualOutgo)}</td><td className="num">{money(row.invest_actual || row.invest_budget)}</td><td className="num">{money(predictedTotal)}</td><td className={`num ${diff < 0 ? "negative" : "positive"}`}>{money(diff)}</td><td><button className="btn danger" onClick={() => onDelete(row.id)}>削除</button></td></tr>;
  })}</tbody></table></div></div>;
}

function InvestmentTable({ rows, onSelect, onDelete }: { rows: InvestmentRecord[]; onSelect: (id: string) => void; onDelete: (id: string) => void }) {
  return <div className="panel"><div className="panel-head"><div className="panel-title">投資一覧</div><span className="badge">K/M inv相当</span></div><div className="table-wrap"><table><thead><tr><th>月</th><th>口座</th><th className="num">入金</th><th className="num">出金</th><th className="num">元本</th><th className="num">予想</th><th className="num">実績</th><th className="num">予想利回り</th><th className="num">実績利回り</th><th></th></tr></thead><tbody>{[...rows].sort((a,b)=>b.month.localeCompare(a.month)).map((row) => {
    const predictedYield = row.capital ? row.predicted_balance / row.capital - 1 : 0;
    const actualYield = row.capital && row.actual_balance ? row.actual_balance / row.capital - 1 : 0;
    return <tr key={row.id}><td><button className="btn" onClick={() => onSelect(row.id)}>{row.month}</button></td><td>{row.account}</td><td className="num">{money(row.deposit)}</td><td className="num">{money(row.withdrawal)}</td><td className="num">{money(row.capital)}</td><td className="num">{money(row.predicted_balance)}</td><td className="num">{money(row.actual_balance)}</td><td className={`num ${predictedYield < 0 ? "negative" : "positive"}`}>{pct.format(predictedYield)}</td><td className={`num ${actualYield < 0 ? "negative" : "positive"}`}>{pct.format(actualYield)}</td><td><button className="btn danger" onClick={() => onDelete(row.id)}>削除</button></td></tr>;
  })}</tbody></table></div></div>;
}

function FundTable({ rows, onSelect, onDelete }: { rows: FundRecord[]; onSelect: (id: string) => void; onDelete: (id: string) => void }) {
  return <div className="panel"><div className="panel-head"><div className="panel-title">投信一覧</div></div><div className="table-wrap"><table><thead><tr><th>日付</th><th>名称</th><th className="num">基準価額</th><th className="num">前日差</th><th className="num">純資産</th><th className="num">保有数</th><th className="num">評価額</th><th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><button className="btn" onClick={() => onSelect(row.id)}>{row.date}</button></td><td>{row.name}</td><td className="num">{yen.format(row.price)}</td><td className={`num ${row.change_amount < 0 ? "negative" : "positive"}`}>{yen.format(row.change_amount)}</td><td className="num">{yen.format(row.nav_million)}</td><td className="num">{yen.format(row.units)}</td><td className="num">{money((row.price * row.units) / 10000)}</td><td><button className="btn danger" onClick={() => onDelete(row.id)}>削除</button></td></tr>)}</tbody></table></div></div>;
}

function TickerTable({ rows, onSelect, onDelete }: { rows: TickerHolding[]; onSelect: (id: string) => void; onDelete: (id: string) => void }) {
  return <div className="panel"><div className="panel-head"><div className="panel-title">個別銘柄一覧</div></div><div className="table-wrap"><table><thead><tr><th>Ticker</th><th className="num">終値</th><th className="num">保有数</th><th className="num">総額</th><th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><button className="btn" onClick={() => onSelect(row.id)}>{row.ticker || "未設定"}</button></td><td className="num">{yen.format(row.price)}</td><td className="num">{yen.format(row.shares)}</td><td className="num">{money(row.price * row.shares)}</td><td><button className="btn danger" onClick={() => onDelete(row.id)}>削除</button></td></tr>)}</tbody></table></div></div>;
}

function FxTable({ rows, onSelect, onDelete }: { rows: FxTrade[]; onSelect: (id: string) => void; onDelete: (id: string) => void }) {
  const monthMap = rows.reduce<Record<string, number>>((acc, row) => { const month = row.date.slice(0, 7); acc[month] = (acc[month] ?? 0) + row.result; return acc; }, {});
  return <div className="two-col"><div className="panel"><div className="panel-head"><div className="panel-title">FX履歴</div></div><div className="table-wrap"><table><thead><tr><th>日付</th><th className="num">損益</th><th>メモ</th><th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><button className="btn" onClick={() => onSelect(row.id)}>{row.date}</button></td><td className={`num ${row.result < 0 ? "negative" : "positive"}`}>{money(row.result)}</td><td>{row.memo}</td><td><button className="btn danger" onClick={() => onDelete(row.id)}>削除</button></td></tr>)}</tbody></table></div></div><div className="panel"><div className="panel-head"><div className="panel-title">月別集計</div></div><div className="table-wrap"><table><thead><tr><th>月</th><th className="num">合計</th></tr></thead><tbody>{Object.entries(monthMap).sort((a,b)=>b[0].localeCompare(a[0])).map(([month,total]) => <tr key={month}><td>{month}</td><td className={`num ${total < 0 ? "negative" : "positive"}`}>{money(total)}</td></tr>)}</tbody></table></div></div></div>;
}
