---
id: "0007"
title: ルーティング — ライブラリ不採用、最小限のURL設計
status: accepted
date: 2026-03-19
superseded_by: null
tags: ["frontend", "routing", "react"]
---

# ADR-0007: ルーティング — ライブラリ不採用、最小限のURL設計

## Context

React Router や TanStack Router の導入を検討した。また、検索・フィルタ条件をURLクエリパラメータに反映する設計も検討した。

## Decision

ルーティングライブラリは使わない。`history.pushState` + `popstate` の薄いラッパーのみ。URLは `/`（一覧）と `/images/:id`（詳細）の2本だけ。検索・フィルタ状態はReactステートで持ち、URLには載せない。比較モードはURLルーティングではなくコンポーネントstateで管理する（URLに反映しない一時的な表示のため）。

## Alternatives

| 選択肢 | 利点 | 欠点 | 不採用理由 |
|--------|------|------|------------|
| React Router / TanStack Router | 宣言的ルーティング、URL ベースの状態管理 | 依存の追加、オーバーキル | ローカル専用で URL のブックマークや共有の需要がなく、画像詳細からの「戻る」だけ効けば十分 |
| 検索・タグフィルタのURLクエリパラメータ化 | URL で検索状態を復元できる | 実装の複雑化 | 必要になってから足しても遅くない（YAGNI） |

## Consequences

**Positive:**

- 依存を増やさずに済む
- ルーティング実装がシンプルで理解しやすい
- 「戻る」操作だけカバーすれば十分な要件に適合

**Negative:**

- URL で検索状態を共有・復元できない（ローカル専用のため問題にならない）
- 将来ルートが増えた場合、薄いラッパーでは不十分になる可能性がある
