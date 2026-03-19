# AI Image Viewer

生成AI画像のローカルビューワー

## 概要

画像のEXIFメタデータ（プロンプト・タイトル）を活用した検索・管理・比較ができるWebアプリケーション。
シングルユーザー・ローカル完結で動作し、Docker対応。

<!-- TODO: スクリーンショットを追加 -->

## 主な機能

- **画像の自動取り込み** — EXIFメタデータ読取 + サムネイル生成（WebP）
- **プロンプト全文検索** — SQLite FTS5による高速検索
- **タグ管理** — AND/ORフィルタ、バルクタグ付け対応
- **画像比較モード** — 複数画像の横並び表示、プロンプトdiffハイライト
- **仮想スクロール** — 大量画像でも快適に閲覧
- **Docker対応** — ボリュームマウント、Basic認証によるLAN公開

## 技術スタック

| レイヤー | 技術 |
|---|---|
| ランタイム | Bun |
| バックエンド | Hono |
| フロントエンド | React + Tailwind CSS |
| ビルド | Vite |
| DB | SQLite (FTS5) |
| サムネイル生成 | sharp |
| EXIF解析 | exifr |
| 仮想スクロール | @tanstack/react-virtual |
| バリデーション | zod |

## クイックスタート

### 前提条件

- [Bun](https://bun.sh/) がインストールされていること

### ローカル開発

```bash
bun install
IMAGE_DIR=/path/to/images bun run dev
# 別ターミナルで
bunx vite --port 5173
```

### Docker

```bash
IMAGE_DIR=/path/to/images docker compose up -d
```

## 使い方

1. 起動後、**Sync**ボタンで画像ディレクトリをスキャンし取り込む
2. 検索バーでプロンプト・タイトルを全文検索
3. 左パネルのタグフィルタで絞り込み
4. 画像クリックで詳細表示（メタデータ確認・タグ編集）
5. Selectモードで複数選択 → 比較モード or バルクタグ付け

## EXIFフィールド設定

`src/server/config.ts` の `exifFieldMapping` を画像生成ツールに合わせて設定する。

```typescript
export const exifFieldMapping = {
  prompt: 'description',   // XMP-dc:Description
  title: 'title',          // XMP-dc:Title
} as const;
```

ツールを変更した場合はこのマッピングを書き換えるだけで対応できる。

## Docker詳細

### ボリューム設計

| マウント先（コンテナ内） | 種別 | 内容 |
|---|---|---|
| `/images` | bind mount (read-only) | ホストの画像ディレクトリ |
| `/data/db` | named volume | SQLiteデータベース |
| `/data/thumbnails` | named volume | 生成サムネイル |

画像ディレクトリはread-onlyでマウントされる。元画像を書き換えることはない。

### 環境変数

| 変数 | デフォルト | 説明 |
|---|---|---|
| `IMAGE_DIR` | `/images` | 画像ディレクトリのパス（**必須**） |
| `DB_PATH` | `/data/db/viewer.db` | SQLiteデータベースのパス |
| `THUMB_DIR` | `/data/thumbnails` | サムネイル格納先 |
| `PORT` | `3000` | サーバーポート |
| `AUTH_USER` | - | Basic認証ユーザー名 |
| `AUTH_PASS` | - | Basic認証パスワード |

### LAN公開時のBasic認証

`AUTH_USER` と `AUTH_PASS` を両方セットすると Basic認証が有効になる。未設定なら認証なし。

```bash
IMAGE_DIR=/path/to/images AUTH_USER=user AUTH_PASS=pass docker compose up -d
```

## 開発

### コマンド一覧

```bash
bun run dev        # 開発サーバー起動
bun run build      # プロダクションビルド
bun run lint       # ESLint実行
bun run typecheck  # 型チェック
bun run format     # Prettier実行
```

### 設計書

詳細な設計・ADRについては [plan.md](./plan.md) を参照。

## ライセンス

MIT
