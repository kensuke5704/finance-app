# Finance Planner App

`Finance.xlsm` の主要機能をWeb化した、GitHub Pagesで動く静的アプリです。

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

## データ保存

データはブラウザのlocalStorageに保存されます。保存キーは従来版と同じため、同じURLで利用する場合は既存データがそのまま残ります。

設定画面の「データのバックアップ」から、版付きJSONファイルを書き出し・復元できます。スマホでは共有メニューからiCloud Drive、Google Drive、AirDropなどへ保存できます。Vercel版や別端末からGitHub Pages版へ移る場合は、移行元でバックアップを書き出してから移行先で復元してください。localStorageはサイトのURLや端末ごとに分かれるため、自動では引き継がれません。

## コード構成

- `app`: Next.jsの画面入口と全体レイアウト
- `components/finance`: 各画面と共通UI部品
- `features/investments`: 投資データ更新など、機能単位の処理
- `lib`: 保存、外部データ取得、計算エンジン
- `types`: 共有データ型

画面コンポーネントは表示と操作を担当し、外部データの同期や口座評価額の集計は機能別サービスへ分離します。既存のバックアップ形式とlocalStorageの保存キーは変更しません。

## GitHub Pages

`main`ブランチへpushすると、GitHub Actionsが静的ファイルを生成してGitHub Pagesへ公開します。

リポジトリの Settings → Pages → Build and deployment で Source を `GitHub Actions` に設定してください。

公開先:

```text
https://kensuke5704.github.io/finance-app/
```

## 制限事項

- データは端末・ブラウザごとの保存です。定期的にJSONバックアップを作成してください。
- 静的サイトにはサーバーAPIがないため、Yahooからの価格自動取得は利用できません。価格は手入力できます。
- 画面上のパスワードは端末内の簡易ロックであり、GitHub Pages上のデータをサーバー側で保護する認証ではありません。
