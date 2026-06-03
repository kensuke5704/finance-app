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
        <div>
          <div className="login-title">Finance Planner</div>
          <p className="login-text">パスワードを入力してください。</p>
        </div>

        <input
          className="input"
          type="password"
          value={password}
          placeholder="Password"
          autoFocus
          onChange={(event) => setPassword(event.target.value)}
        />

        {error && <div className="login-error">{error}</div>}

        <button className="btn primary" type="submit">
          ログイン
        </button>

        <p className="login-note">
          認証はこのブラウザに30日間保存されます。
        </p>
      </form>
    </main>
  );
}
