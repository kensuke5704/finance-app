# Finance Planner App

`Finance.xlsm` の主要機能を Next.js + Supabase でWeb化したPC向けアプリです。

## 実装機能

- 月次資産計画: 現金予測/実績、収入、支出、投資、USD、予測差額
- 投資口座管理: WealthNavi / ROBOPRO / INDEX / Active / NISA / NASDAQ100 の入出金・元本・予想残高・実績残高・利回り
- ファンド・銘柄管理: eMAXIS Neo 宇宙開発、ROBOPROファンド、mega10、個別Tickerの評価額
- FX損益管理: 日別損益入力、月別合計
- ロスカット計算: 保証金、通貨数、約定価格、現在レート、レバレッジ、swapから含み損・不足保証金・概算ロスカット水準を計算

## ローカル実行

```bash
npm install
npm run dev
```

ブラウザで開く場所:

```text
http://localhost:3000
```

## Supabaseを使う場合

1. Supabase SQL Editorで `supabase/schema.sql` を実行
2. Vercelまたは `.env.local` に以下を設定

```text
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

環境変数が未設定の場合は、ブラウザのlocalStorageに保存されます。

## Vercel反映

```bash
git add .
git commit -m "create finance planner app"
git push
```

Vercelで自動デプロイされない場合は、DeploymentsからRedeployしてください。
