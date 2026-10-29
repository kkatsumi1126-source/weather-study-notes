# 気象予報士 AI問題・解説集

React + TypeScript + Viteの独立した学習サイトです。既存の気象フラッシュカードとは別プロジェクトです。

## 起動・確認

Node.js 24とpnpm 11を使用します。

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
```

サンプル20問の一覧、解説開閉、検索・絞り込み、正誤記録、2回連続正解で習得済みになる間違い復習に対応しています。

Supabase未設定の場合は従来の端末内保存モードです。.env.exampleを.env.localへコピーし、専用SupabaseプロジェクトのURLと公開用キーを設定すると、メールリンクログイン・クラウド保存・端末間同期が有効になります。変更後は開発サーバーを再起動してください。

設定は [Supabase設定手順](docs/Supabase設定手順.md) を1から順番に進めてください。SQL・サンプル登録・GitHub Pages用の手動公開workflowを同梱しています。専用Supabaseへの適用とGitHub Pages公開は完了しています。公開URLの認証リダイレクト設定・iPhone実機確認は継続中です。

履歴はアカウント別IndexedDBにまず保存され、同じIDで再送されます。未送信の進捗は暫定表示です。以前の端末内履歴はログイン後の引き継ぎボタンでコピーでき、元の履歴は消しません。端末内のデータを削除すると未送信分は失われます。

- [設計書](docs/設計書.md)
- [動作確認](docs/動作確認.md)
- [SQL](supabase/migrations/001_study_sync.sql)
- [サンプル20問登録](supabase/seed.sql)

今回の問題は画面確認用オリジナル教材です。クラウドの問題テーブルは現在ログイン利用者共通のサンプル専用で、私有問題集の取り込みは後続段階です。ローカル版でのメールログイン・正誤保存・習得状態の再読み込み保持は利用者の操作で確認済みです。公開版ログインとiPhone・Mac間の実機同期は確認中です。

## 公開サイト

https://kkatsumi1126-source.github.io/weather-study-notes/

公開設定：GitHub Actionsからの手動デプロイ。公開URLとJS・CSSのHTTP 200、ログインフォーム・20問の表示を確認済み。SupabaseのSite URLとRedirect URLsへの公開URL登録後、同じアカウントでログインします。
