# AI Image Viewer

## アーキテクチャ

- 設計書: plan.md を参照
- 技術スタック: Bun + Hono + React + Vite + SQLite(FTS5) + sharp + exifr

## 開発コマンド

- `bun run dev` — 開発サーバー起動
- `bun run build` — プロダクションビルド
- `bun run lint` — ESLint実行
- `bun run typecheck` — 型チェック
- `bun run format` — Prettier実行

## コーディングルール

- モジュール境界の厳守（server/ と client/ を跨ぐimportは shared/ 経由のみ）
- DBスキーマ変更時はマイグレーションスクリプトを作成
- 新しいAPIエンドポイント追加時はplan.mdのAPI設計セクションも更新
- サムネイルは data/thumbnails/ に格納、元画像は絶対に触らない
- EXIFフィールドマッピングは config.ts に集約、ハードコードしない
- 画像の削除は物理DELETE。ON DELETE CASCADEでタグ関連も消える
- 同期処理（sync.ts）はingest.ts（単一ファイル処理）を呼ぶ形にする
- `as` キャスト禁止。型変換は必ず zod の `.parse()` を通す
- 新しいデータ型を追加する際は shared/brands.ts に Branded Type を定義
- `any` 型禁止。`unknown` + zodバリデーションで対応
- コミット前に `bun run lint` と `bun run typecheck` が通ることを確認
- ESLintエラーを `eslint-disable` で黙らせない。型設計で解決
- パスをハードコードしない。必ず `env.IMAGE_DIR`, `env.DB_PATH`, `env.THUMB_DIR` を参照
- Dockerfileを変更した場合は `docker compose build` で動作確認

## 開発フェーズ

- Phase 1 (MVP): 実装中
- Phase 2 (タグ): 未着手
- Phase 3 (比較・拡張): 未着手
- 機能追加は Phase 順に進める。Phaseを飛ばさない
