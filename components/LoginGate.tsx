"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";

const STORAGE_KEY = "finance-app-authenticated-until";
const DAYS = 30;

function getPassword() {
  return process.env.NEXT_PUBLIC_APP_PASSWORD || "finance";
}

function getExpiry() {
  return Date.now() + DAYS * 24 * 60 * 60 * 1000;
}

export default function LoginGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const expiresAt = Number(localStorage.getItem(STORAGE_KEY) || 0);
    setAuthenticated(expiresAt > Date.now());
    setReady(true);
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password === getPassword()) {
      localStorage.setItem(STORAGE_KEY, String(getExpiry()));
      setAuthenticated(true);
      setPassword("");
      return;
    }

    setError("パスワードが違います");
  }

  if (!ready) {
    return (
      <main className="login-page">
        <div className="login-card">読み込み中...</div>
      </main>
    );
  }

  if (authenticated) {
    return <>{children}</>;
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <div>
            <p className="login-kicker">Personal finance</p>
            <div className="login-title">Finance App</div>
          </div>
        </div>

        <div>
          <p className="login-heading">ログイン</p>
          <p className="login-text">パスワードを入力して、保存済みのデータを開きます。</p>
        </div>

        <label className="field login-password-field">
          <span className="label">パスワード</span>
          <input
            className="input"
            type="password"
            value={password}
            placeholder="パスワードを入力"
            autoFocus
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error && <div className="login-error">{error}</div>}

        <button className="btn primary" type="submit">
          ログイン
        </button>

        <p className="login-note">
          データはこの端末内に保存されます。認証状態は30日間保持されます。
        </p>
      </form>
    </main>
  );
}
