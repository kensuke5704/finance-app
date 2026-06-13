import Link from "next/link";
import LoginGate from "../../components/LoginGate";
import MomentumSelectionView from "../../components/finance/MomentumSelectionView";

export default function MomentumPage() {
  return (
    <LoginGate>
      <main className="page">
        <div className="shell">
          <header className="app-header">
            <div>
              <p className="app-eyebrow">Finance App</p>
              <h1 className="app-screen-title">Momentum 選定</h1>
            </div>
            <Link className="btn" href="/">
              ホームへ戻る
            </Link>
          </header>
          <MomentumSelectionView />
        </div>
      </main>
    </LoginGate>
  );
}
