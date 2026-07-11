import Link from "next/link";
import LoginGate from "../../components/LoginGate";
import MomentumSelectionView from "../../components/finance/MomentumSelectionView";

export default function MomentumPage() {
  return (
    <LoginGate>
      <main className="page momentum-page">
        <div className="momentum-workspace">
          <header className="momentum-header">
            <div>
              <p>投資分析</p>
              <h1>Momentum 選定</h1>
            </div>
            <Link className="btn" href="/">
              Finance Appへ戻る
            </Link>
          </header>
          <MomentumSelectionView />
        </div>
      </main>
    </LoginGate>
  );
}
