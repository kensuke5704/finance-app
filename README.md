# Finance

2025年1月以降の月ごとの資産額を記録する、1ページ構成の静的Webサイトです。

## 機能

- 月別の資産額入力
- 資産項目の追加・名称変更・削除
- 入力がある最古月から最新月までを表示する積み上げグラフ
- 期間別の予算・年利に基づく資産予測
- K・Mの2アカウント管理とGoogle同期
- 2アカウントをまとめたバックアップの保存・復元
- ブラウザへの自動保存
- PC・モバイル対応

## ローカル実行

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## データ保存

入力内容はブラウザの `localStorage` に保存されます。保存キーは新サイト専用の
`finance.monthly-assets.v1` です。Google同期を有効にした場合は、許可済みアカウント間で
Firestoreにも同期します。バックアップの復元では、旧形式の単一アカウントデータも読み込めます。

## GitHub Pages

`main` ブランチへpushすると、GitHub Actionsが静的ファイルを生成して公開します。

公開先: `https://kensuke5704.github.io/finance-app/`
