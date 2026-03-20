# AI Image Viewer — アーキテクチャ設計書

## プロジェクト概要

生成AI画像のローカルビューワー。  
画像のEXIFメタデータ（プロンプト・タイトル）を活用した検索・管理・比較が可能。  
シングルユーザー、ローカル完結。Claude Codeによる自律開発を前提とする。

## 技術スタック

| レイヤー | 技術 | 理由 |
|---|---|---|
| ランタイム | Bun | TS統一、SQLiteネイティブサポート、高速 |
| バックエンド | Hono | 軽量、Bunとの親和性、型安全 |
| フロントエンド | React + Tailwind CSS | 仮想スクロールのエコシステム、Claude Codeとの相性 |
| ビルド | Vite | React開発のデファクト |
| DB | SQLite (bun:sqlite) | ローカル完結、FTS5で全文検索 |
| EXIF解析 | exifr | TS製、非同期、幅広いタグ対応 |
| サムネイル | sharp | 高速、WebP出力対応 |
| 仮想スクロール | @tanstack/react-virtual | 軽量、柔軟 |
| バリデーション | zod | ランタイム型検証、Branded Types基盤 |
| リンター | ESLint (flat config) + typescript-eslint | 厳格な静的解析 |
| フォーマッター | Prettier | コードスタイル統一 |
| コンテナ | Docker + Compose | 実行環境の再現性、Bun不要のデプロイ |

## 型システム設計

### Branded Types

素のプリミティブ型（number, string）の取り違えをコンパイル時に防ぐ。
zodの `.brand()` で Branded Type を定義し、全レイヤーで一貫して使う。

```typescript
// src/shared/brands.ts
import { z } from 'zod';

// --- ID型 ---
export const ImageId = z.number().int().positive().brand<'ImageId'>();
export type ImageId = z.infer<typeof ImageId>;

export const TagId = z.number().int().positive().brand<'TagId'>();
export type TagId = z.infer<typeof TagId>;

// --- パス型 ---
export const FilePath = z.string().min(1).brand<'FilePath'>();
export type FilePath = z.infer<typeof FilePath>;

export const ThumbPath = z.string().min(1).brand<'ThumbPath'>();
export type ThumbPath = z.infer<typeof ThumbPath>;

// --- ドメイン値 ---
export const Prompt = z.string().brand<'Prompt'>();
export type Prompt = z.infer<typeof Prompt>;

export const TagName = z.string().min(1).max(100).brand<'TagName'>();
export type TagName = z.infer<typeof TagName>;

export const ISODateString = z.string().datetime().brand<'ISODateString'>();
export type ISODateString = z.infer<typeof ISODateString>;
```

### 適用方針

- DB層（queries.ts）の戻り値は必ず Branded Type を返す
- APIルートのパスパラメータ・リクエストボディは zod スキーマでバリデーション
- コンポーネントの props にも Branded Type を使い、IDの型違いをコンパイル時に検出
- `as` によるキャストは禁止。必ず zod の `.parse()` または `.safeParse()` を通す

### zodスキーマ例

```typescript
// src/shared/schemas.ts
import { z } from 'zod';
import { ImageId, TagId, FilePath, ThumbPath, Prompt, TagName, ISODateString } from './brands';

export const ImageRow = z.object({
  id: ImageId,
  file_path: FilePath,
  file_name: z.string(),
  title: z.string().nullable(),
  prompt: Prompt.nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  file_size: z.number().int().nullable(),
  file_mtime: ISODateString,
  thumb_path: ThumbPath.nullable(),
  created_at: ISODateString,
  updated_at: ISODateString,
});
export type ImageRow = z.infer<typeof ImageRow>;

export const TagRow = z.object({
  id: TagId,
  name: TagName,
});
export type TagRow = z.infer<typeof TagRow>;

// APIリクエスト
export const SearchQuery = z.object({
  q: z.string().min(1).max(500),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const ImagePatchBody = z.object({
  title: z.string().optional(),
});

export const TagCreateBody = z.object({
  name: TagName,
});

// APIレスポンス
export const SyncResult = z.object({
  added: z.number().int(),
  updated: z.number().int(),
  deleted: z.number().int(),
  unchanged: z.number().int(),
});
export type SyncResult = z.infer<typeof SyncResult>;
```

### バリデーション適用箇所

```
[APIリクエスト]
  → zodスキーマで .parse() → 失敗なら 400 Bad Request
  → Branded Type がついた値がサービス層に渡る
  → DB層もBranded Typeで受け取る → 型の不一致はコンパイルエラー

[DB → APIレスポンス]
  → queries.ts の戻り値を zodスキーマで .parse()
  → Branded Type がついた値がクライアントに渡る
```

## Linter・コード品質設定

### ESLint（Flat Config）

```typescript
// eslint.config.ts
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // --- 厳格な型安全 ---
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-import-type-side-effects': 'error',

      // --- 未使用コード検出 ---
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],

      // --- asキャスト禁止（Branded Types強制） ---
      '@typescript-eslint/consistent-type-assertions': ['error', {
        assertionStyle: 'never',
      }],

      // --- その他 ---
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'eqeqeq': ['error', 'always'],
    },
  },
  {
    files: ['src/client/**/*.{ts,tsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react/jsx-no-leaked-render': 'error',
    },
  },
);
```

### TypeScript設定

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true
  }
}
```

### ルール設計の意図

- `consistent-type-assertions: never` — `as` キャストを全面禁止。Branded Typesを形骸化させない。型変換は必ず zod の `.parse()` を通す
- `strictTypeChecked` — typescript-eslintの最も厳しいプリセット。型情報を使った高精度チェック
- `strict-boolean-expressions` — `if (value)` のような暗黙のtruthyチェックを禁止。`null` と `undefined` と `0` と `""` の区別を強制
- `noUncheckedIndexedAccess` — 配列・オブジェクトのインデックスアクセスに `| undefined` を付与。境界外アクセスをコンパイル時に検出
- `exactOptionalPropertyTypes` — `{ x?: string }` に `undefined` を明示的に代入することを禁止

## ディレクトリ構成

```
ai-image-viewer/
├── CLAUDE.md                    # Claude Code用コンテキスト
├── Dockerfile                   # マルチステージビルド（本番用）
├── compose.yaml                 # ボリュームマウント定義
├── .dockerignore
├── package.json
├── tsconfig.json
├── eslint.config.ts             # ESLint Flat Config（厳格設定）
├── .prettierrc                  # Prettier設定
├── bunfig.toml
│
├── src/
│   ├── server/                  # バックエンドAPI
│   │   ├── index.ts             # Honoエントリポイント
│   │   ├── config.ts            # 環境変数からのパス解決
│   │   ├── routes/
│   │   │   ├── images.ts        # 画像CRUD・検索API
│   │   │   ├── tags.ts          # タグCRUD API
│   │   │   └── sync.ts          # 同期API
│   │   ├── db/
│   │   │   ├── schema.ts        # テーブル定義・マイグレーション
│   │   │   ├── connection.ts    # SQLiteコネクション管理
│   │   │   └── queries.ts       # クエリビルダー
│   │   └── services/
│   │       ├── ingest.ts        # EXIF読取・サムネ生成（単一ファイル処理）
│   │       ├── sync.ts          # 差分検出・フルスキャン
│   │       └── search.ts        # FTS5検索ロジック
│   │
│   ├── client/                  # フロントエンドSPA
│   │   ├── main.tsx             # Reactエントリポイント
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ImageGrid.tsx    # 仮想スクロールグリッド
│   │   │   ├── ImageCard.tsx    # 個別画像カード
│   │   │   ├── SearchBar.tsx    # プロンプト検索
│   │   │   ├── TagFilter.tsx    # タグフィルタパネル
│   │   │   ├── ImageDetail.tsx  # 画像詳細ビュー（メタデータ表示）
│   │   │   ├── CompareView.tsx  # 比較モード
│   │   ├── hooks/
│   │   │   ├── useImages.ts     # 画像データフェッチ
│   │   │   ├── useTags.ts       # タグ操作
│   │   │   └── useSearch.ts     # 検索状態管理
│   │   └── lib/
│   │       ├── api.ts           # APIクライアント
│   │       └── types.ts         # 共有型定義
│   │
│   └── shared/
│       ├── brands.ts            # Branded Type定義（zod .brand()）
│       ├── schemas.ts           # zodスキーマ（リクエスト/レスポンス/DB行）
│       └── types.ts             # 推論された型のre-export
│
├── data/                        # .gitignore対象、Docker時はボリューム
│   ├── viewer.db                # SQLiteデータベース
│   └── thumbnails/              # 生成サムネイル格納先
│
└── scripts/
    └── ingest.ts                # CLIインジェストスクリプト
```

## データベース設計

### テーブル定義

```sql
-- 画像メタデータ
CREATE TABLE images (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path   TEXT NOT NULL UNIQUE,          -- 元画像の絶対パス
  file_name   TEXT NOT NULL,                 -- ファイル名
  title       TEXT,                          -- EXIFから抽出したタイトル
  prompt      TEXT,                          -- EXIFから抽出したプロンプト
  width       INTEGER,
  height      INTEGER,
  file_size   INTEGER,                       -- bytes
  file_mtime  TEXT NOT NULL,                 -- ファイル最終更新日時（ISO8601）
  thumb_path  TEXT,                          -- サムネイルの相対パス
  created_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))  -- zodの `z.iso.datetime()` でバリデーションするため、ISO 8601形式で格納する
);

-- 全文検索インデックス（プロンプト・タイトル）
CREATE VIRTUAL TABLE images_fts USING fts5(
  title,
  prompt,
  content='images',
  content_rowid='id'
);

-- FTS同期トリガー
CREATE TRIGGER images_ai AFTER INSERT ON images BEGIN
  INSERT INTO images_fts(rowid, title, prompt)
  VALUES (new.id, new.title, new.prompt);
END;

CREATE TRIGGER images_ad AFTER DELETE ON images BEGIN
  INSERT INTO images_fts(images_fts, rowid, title, prompt)
  VALUES ('delete', old.id, old.title, old.prompt);
END;

CREATE TRIGGER images_au AFTER UPDATE ON images BEGIN
  INSERT INTO images_fts(images_fts, rowid, title, prompt)
  VALUES ('delete', old.id, old.title, old.prompt);
  INSERT INTO images_fts(rowid, title, prompt)
  VALUES (new.id, new.title, new.prompt);
END;

-- タグ
CREATE TABLE tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

-- 画像-タグ関連（多対多）
CREATE TABLE image_tags (
  image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  tag_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (image_id, tag_id)
);

-- インデックス
CREATE INDEX idx_images_created  ON images(created_at);
CREATE INDEX idx_images_mtime    ON images(file_mtime);
CREATE INDEX idx_image_tags_tag  ON image_tags(tag_id);
```

## API設計

### 認証

LAN公開時のアクセス保護として、Basic認証をHonoミドルウェアで実装する。

```typescript
// src/server/index.ts
import { basicAuth } from 'hono/basic-auth';
import { env } from './config';

if (env.AUTH_USER !== undefined && env.AUTH_PASS !== undefined) {
  app.use('/*', basicAuth({
    username: env.AUTH_USER,
    password: env.AUTH_PASS,
  }));
}
```

- `AUTH_USER` と `AUTH_PASS` が両方セットされている場合のみ有効
- 未設定ならミドルウェア自体を登録しない（localhost専用時のゼロコスト）
- Basic認証はHTTPSなしだとパスワードが平文で流れるが、LAN内の自宅用途なら許容範囲

### 画像

| Method | Path | 説明 |
|---|---|---|
| GET | `/api/images` | 一覧取得（ページネーション、ソート、タグフィルタ対応） |
| GET | `/api/images/search` | FTS5全文検索 |
| GET | `/api/images/:id` | 詳細取得（`tags` 配列を含む） |
| PATCH | `/api/images/:id` | メタデータ更新（タイトル編集等） |
| GET | `/api/images/:id/file` | 元画像配信 |
| GET | `/api/images/:id/thumb` | サムネイル配信 |

#### GET /api/images クエリパラメータ

| パラメータ | 型 | デフォルト | 説明 |
|---|---|---|---|
| `page` | number | `1` | ページ番号（1始まり） |
| `limit` | number | `50` | 1ページあたりの件数（1〜100） |
| `sort` | string | — | ソートカラム名 |
| `order` | string | — | `asc` または `desc` |
| `tags` | string | — | タグIDのカンマ区切りリスト（例: `1,2,3`） |
| `tagMode` | string | `or` | `and`（全タグ一致）/ `or`（いずれか一致）/ `not`（除外） |

### タグ

| Method | Path | 説明 |
|---|---|---|
| GET | `/api/tags` | タグ一覧（画像数付き） |
| POST | `/api/tags` | タグ作成 |
| DELETE | `/api/tags/:id` | タグ削除 |
| POST | `/api/images/bulk/tags` | 複数画像への一括タグ付与（body: `{ imageIds: number[], tagId: number }`） |
| POST | `/api/images/:id/tags` | 画像にタグ付与（body: `{ tag_id: number }`） |
| DELETE | `/api/images/:id/tags/:tagId` | 画像からタグ除去 |

### 同期

| Method | Path | 説明 |
|---|---|---|
| POST | `/api/sync` | フルスキャン実行（UIの更新ボタンから呼ぶ） |
| GET | `/api/sync/status` | 最終スキャン日時、前回の同期結果サマリ |

## 同期設計

### 概要

画像ディレクトリは外部ツールによって随時変更される（追加・削除・上書き・メタデータ更新）。
ユーザーがUIの「更新」ボタンを押した時にフルスキャンを実行し、DBとファイルシステムを同期する。

自動監視（ファイルウォッチャー）は行わない。シンプルさを優先する。

### 同期フロー

```
[ユーザーが更新ボタンを押す]
  → POST /api/sync
  → ディレクトリを再帰走査
  → 全ファイルのパス・mtime・sizeを取得
  → DBの全レコードと突合
  → 差分に応じて add / update / delete を実行
  → 結果サマリを返却 { added: N, updated: N, deleted: N, unchanged: N }
```

### 差分検出ロジック

| ファイル状態 | DB状態 | アクション |
|---|---|---|
| 存在する | 未登録 | EXIF読取 → サムネ生成 → INSERT |
| 存在する | 登録済み、mtime or size 変化あり | EXIF再読取 → サムネ再生成 → UPDATE |
| 存在する | 登録済み、mtime and size 変化なし | スキップ |
| 存在しない | 登録済み | サムネ削除 → DELETE（CASCADE でタグも消える） |

```typescript
interface FileInfo {
  path: FilePath;
  mtime: ISODateString;
  size: number;
}

type SyncAction =
  | { type: 'add'; file: FileInfo }
  | { type: 'update'; file: FileInfo; imageId: ImageId }
  | { type: 'delete'; imageId: ImageId; thumbPath: ThumbPath | null }
  | { type: 'skip' };

function detectChange(file: FileInfo | null, dbRecord: ImageRow | null): SyncAction {
  if (file && !dbRecord) {
    return { type: 'add', file };
  }
  if (file && dbRecord) {
    if (file.mtime !== dbRecord.file_mtime || file.size !== dbRecord.file_size) {
      return { type: 'update', file, imageId: dbRecord.id };
    }
    return { type: 'skip' };
  }
  if (!file && dbRecord) {
    return { type: 'delete', imageId: dbRecord.id, thumbPath: dbRecord.thumb_path };
  }
  return { type: 'skip' };
}
```

### 削除の方針

物理DELETE。`ON DELETE CASCADE` によりタグ関連も自動で消える。
画像ファイルが唯一のソースなので、ファイルが消えたらメタデータを保持する理由がない。
サムネイルも一緒に削除する。

### サムネイルのファイル名

画像ファイルパスのSHA-256先頭16文字をファイル名に使う。
上書き時に同一パスへ再生成されるので冪等。

```typescript
function thumbPath(filePath: FilePath): ThumbPath {
  const hash = crypto.createHash('sha256').update(filePath).digest('hex').slice(0, 16);
  return ThumbPath.parse(path.join(THUMB_DIR, `${hash}.webp`));
}
```

## インジェスト処理

### EXIFメタデータ読み取り

自作ツールによる生成のため、メタデータのフィールドは固定。
フォールバック不要。設定ファイルでフィールド名を指定する。

```typescript
// config.ts
export const exifFieldMapping = {
  prompt: 'description',   // XMP-dc:Description（exifrでは小文字）
  title: 'title',          // XMP-dc:Title（exifrでは小文字）
} as const;
```

> **XMP値の形式:** exifrはXMPフィールドを `string` または `{ lang: string, value: string }` の形で返す。
> ingest.ts では zod union で両形式に対応し、value を抽出する。

> **初回セットアップ時**: 実際の画像を1枚 exifr で読んで、
> プロンプトとタイトルがどのフィールドに格納されているかを確認し、
> config.ts を設定すること。

### サムネイル生成

- sharpで長辺400px、WebP、quality 80
- 出力先: `data/thumbnails/{hash}.webp`
- 上書き時は同一パスに再生成（ハッシュベースなので冪等）

## フロントエンド設計方針

### 画面構成

```
┌──────────────────────────────────────────────────────┐
│  [検索バー]                [🔄 更新] [フィルタ] [表示切替] │
├────────┬─────────────────────────────────────────────┤
│        │                                             │
│  タグ   │    画像グリッド（仮想スクロール）               │
│  パネル │    ┌────┐ ┌────┐ ┌────┐ ┌────┐              │
│        │    │    │ │    │ │    │ │    │              │
│  □ tag1 │    └────┘ └────┘ └────┘ └────┘              │
│  □ tag2 │    ┌────┐ ┌────┐ ┌────┐ ┌────┐              │
│  □ tag3 │    │    │ │    │ │    │ │    │              │
│        │    └────┘ └────┘ └────┘ └────┘              │
│        │                ...                           │
└────────┴─────────────────────────────────────────────┘
```

### 更新ボタンの振る舞い

- クリックで `POST /api/sync` を発火
- 同期中はスピナー表示、UI操作はブロックしない
- 完了後、結果サマリをトースト通知（例: 「3件追加、1件更新、2件削除」）
- 画像一覧を自動リフレッシュ

### ルーティング

ルーティングライブラリは使わない。`history.pushState` + `popstate` の薄いラッパーで十分。

| パス | 画面 | 状態管理 |
|---|---|---|
| `/` | 画像一覧 | `?q=`（検索）`?tags=1,2`（タグ）`?tagMode=and`（モード）をsearch paramsで同期 |
| `/images/:id` | 画像詳細 | IDだけURLに載せる。戻るボタンで一覧に帰れる |
| `/compare?ids=1,2,3` | 比較ビュー | 比較対象の画像IDをsearch paramsで保持 |

フィルタ状態はURL search paramsと双方向同期する。変更時は `replaceState`（履歴を汚さない）、ページ遷移時は `pushState`。リロード・戻る/進むで状態が復元される。

### 状態管理

React標準の状態管理で十分。外部ライブラリは入れない。

- `useImages` — 画像一覧・ページネーション・検索結果
- `useTags` — タグ一覧・フィルタ状態
- `useSearch` — 検索クエリ・デバウンス

### 仮想スクロール

- `@tanstack/react-virtual` を使い、グリッドの行単位で仮想化する
- ウィンドウリサイズ時はカラム数とコンテナ幅（50pxバケット）をkeyにしてVirtualGridを再マウントし、行高のキャッシュ不整合を防ぐ。

### 無限スクロール

- 画像一覧は50件ずつ段階的に読み込む（IntersectionObserverで末尾検知）
- useReducerベースで画像を蓄積（ページ切替ではなく追記）
- タグフィルタ変更・検索時はリセットして再取得

### タグフィルタ

- 複数タグのAND/OR/NOT切替に対応

### 比較モード（Phase 2）

- グリッドから2枚以上選択 → 比較モード起動
- 横並び表示 + メタデータ対比
- 差分がわかりやすいようにプロンプトのdiffハイライト（Nice to have）
- 比較モードは `/compare?ids=1,2,3` でURLルーティングに統合。リロード・戻る/進むで復元される

## Docker実行環境

### 設計方針

- 実行環境のみDockerで管理。開発環境はホスト直接でもDockerでもどちらでもよい
- アプリ本体はコンテナに閉じ込め、データは全てボリュームで外出し
- ホストに Bun がなくても `docker compose up` だけで動く

### ボリューム設計

| マウント先（コンテナ内） | 種別 | 内容 |
|---|---|---|
| `/images` | bind mount (read-only) | ホストの画像ディレクトリ |
| `/data/db` | named volume | SQLiteデータベース（viewer.db） |
| `/data/thumbnails` | named volume | 生成サムネイル |

画像ディレクトリは read-only でマウントする。ビューワーが元画像を書き換えることは絶対にない。
DB・サムネイルは named volume にして、コンテナを作り直してもデータが残るようにする。

### 環境変数

アプリ内のパスはすべて環境変数で解決する。ハードコードしない。

```typescript
// src/server/config.ts
import { z } from 'zod';

const EnvSchema = z.object({
  IMAGE_DIR: z.string().min(1).default('/images'),
  DB_PATH: z.string().min(1).default('/data/db/viewer.db'),
  THUMB_DIR: z.string().min(1).default('/data/thumbnails'),
  PORT: z.coerce.number().int().positive().default(3000),
  AUTH_USER: z.string().min(1).optional(),
  AUTH_PASS: z.string().min(1).optional(),
});

// Docker Compose経由で空文字列が渡される場合があるため、空文字列は `undefined` に変換する。
export const env = EnvSchema.parse(process.env);
```

`AUTH_USER` と `AUTH_PASS` が両方セットされている場合のみBasic認証を有効にする。
未設定なら認証なし（localhost直接アクセス時向け）。

開発時（ホスト直接）は `IMAGE_DIR=./my-images DB_PATH=./data/viewer.db THUMB_DIR=./data/thumbnails` のように指定するか、デフォルト値を開発用に上書きする。

### Dockerfile

```dockerfile
# --- build ---
FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# --- production ---
FROM oven/bun:1-slim AS production
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips-dev \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json /app/bun.lock ./
RUN bun install --frozen-lockfile --production

COPY --from=build /app/src ./src

# データディレクトリの事前作成
RUN mkdir -p /data/db /data/thumbnails

ENV NODE_ENV=production
ENV IMAGE_DIR=/images
ENV DB_PATH=/data/db/viewer.db
ENV THUMB_DIR=/data/thumbnails
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "src/server/index.ts"]
```

**ポイント:**
- マルチステージビルド。ビルド成果物だけを本番イメージに持っていく
- BunはTypeScriptを直接実行できるため、ビルド済みJSではなくソースを実行する
- `libvips-dev` は sharp が必要とするネイティブ依存。サムネイル生成に必須
- `--production` で devDependencies を除外。イメージサイズを抑える

### compose.yaml

```yaml
services:
  viewer:
    build: .
    ports:
      - "${PORT:-3000}:3000"
    volumes:
      - ${IMAGE_DIR:?IMAGE_DIR is required}:/images:ro
      - db-data:/data/db
      - thumb-data:/data/thumbnails
    environment:
      - IMAGE_DIR=/images
      - DB_PATH=/data/db/viewer.db
      - THUMB_DIR=/data/thumbnails
      - PORT=3000
      - AUTH_USER=${AUTH_USER:-}
      - AUTH_PASS=${AUTH_PASS:-}
    restart: unless-stopped

volumes:
  db-data:
  thumb-data:
```

### 使い方

```bash
# 起動（画像ディレクトリを指定）
IMAGE_DIR=/path/to/your/images docker compose up -d

# LAN公開時は認証を付ける
IMAGE_DIR=/path/to/your/images AUTH_USER=manabe AUTH_PASS=secretpass docker compose up -d

# ログ確認
docker compose logs -f

# 停止
docker compose down

# データも含めて完全リセット
docker compose down -v
```

### パス解決の整合性

コンテナ内ではすべてのパスが `/images/*`, `/data/*` に統一される。
DB内の `file_path` カラムにはコンテナ内パス（`/images/xxx.png`）が入る。

これはつまり、同じ画像ディレクトリを別のパスにマウントし直すと
DBのパスと不整合が起きるということ。その場合はDBをリセット（`docker compose down -v`）
して再スキャンする。シングルユーザー・ローカル用途なので、これで十分。

## 開発フェーズ

### Phase 1 — MVP

- [x] プロジェクト初期化（Bun + Hono + Vite + React）
- [x] ESLint + Prettier + tsconfig 厳格設定
- [x] Branded Types + zodスキーマ定義（shared/brands.ts, schemas.ts）
- [x] 環境変数によるパス解決（config.ts）
- [x] SQLiteスキーマ構築（マイグレーション）
- [x] 単一ファイルインジェスト（EXIF読取 + サムネイル生成）
- [x] フルスキャン同期（更新ボタンから手動トリガー）
- [x] 画像一覧API + グリッド表示（仮想スクロール）
- [x] プロンプト全文検索
- [x] Dockerfile + compose.yaml

### Phase 2 — タグ

- [x] タグCRUD + 画像へのタグ付与UI
- [x] タグでのフィルタ（複数タグのAND/OR/NOT切替）
- [x] バルクタグ付け（複数画像を選択して一括付与）

### Phase 3 — 比較・拡張

- [x] 比較モード
- [x] プロンプトdiffハイライト
- [x] ソート機能（日付、ファイルサイズ等）（Phase 1 で実装済み）

## Claude Code向けメモ

### CLAUDE.md に記載すべきこと

- このドキュメントへの参照
- モジュール境界の厳守（server/ と client/ を跨ぐimportは shared/ 経由のみ）
- DBスキーマ変更時はマイグレーションスクリプトを作成すること
- 新しいAPIエンドポイント追加時はこのドキュメントのAPI設計セクションも更新
- テスト方針: APIは Bun test、フロントはコンポーネント単位の動作確認
- サムネイルは data/thumbnails/ に格納、元画像は絶対に触らない
- EXIFフィールドマッピングは config.ts に集約、ハードコードしない
- 画像の削除は物理DELETE。ON DELETE CASCADEでタグ関連も消える
- 同期処理（sync.ts）はingest.ts（単一ファイル処理）を呼ぶ形にする。直接DBを触らない
- **`as` キャスト禁止。型変換は必ず zod の `.parse()` を通すこと**
- **新しいデータ型を追加する際は shared/brands.ts に Branded Type を定義すること**
- **`any` 型禁止。`unknown` + zodバリデーションで対応すること**
- **コミット前に `bun run lint` と `bun run typecheck` が通ることを確認すること**
- **ESLintエラーを `eslint-disable` で黙らせない。型設計で解決すること**
- **パスをハードコードしない。必ず `env.IMAGE_DIR`, `env.DB_PATH`, `env.THUMB_DIR` を参照すること**
- **Dockerfileを変更した場合は `docker compose build` で動作確認すること**

### 自律開発時の判断基準

- 機能追加は Phase 順に進める。Phaseを飛ばさない
- 既存APIの破壊的変更を避ける。新しいエンドポイントで拡張する
- パフォーマンス改善は計測してから。推測で最適化しない
- UIの見た目よりまず動くことを優先。スタイリングは後から整える

## ADR（Architecture Decision Records）

設計判断の記録は [docs/adr/](./docs/adr/) に格納。
