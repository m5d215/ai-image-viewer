---
id: '0002'
title: ORM不採用 — Prisma不採用、bun:sqlite直接利用
status: accepted
date: 2026-03-19
superseded_by: null
tags: ['database', 'orm', 'sqlite', 'bun']
---

# ADR-0002: ORM不採用 — Prisma不採用、bun:sqlite直接利用

## Context

DBアクセス層にPrismaを入れるか検討した。

## Decision

Prismaは使わない。bun:sqliteのネイティブバインディングを直接使い、queries.tsに型付きヘルパーを薄く書く。

## Alternatives

| 選択肢              | 利点                                         | 欠点                                                                                                  | 不採用理由                                                                   |
| ------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Prisma + bun:sqlite | 型安全なクエリビルダー、マイグレーション管理 | FTS5 が表現できず生 SQL 必須、`prisma generate` / `prisma migrate` のステップが開発フローに摩擦を生む | この規模では ORM の抽象化の恩恵より SQL を直接制御できるメリットの方が大きい |

## Consequences

**Positive:**

- FTS5（CREATE VIRTUAL TABLE、トリガー）を自由に使える
- bun:sqlite との間に余計なレイヤーがなく、パフォーマンスと透明性が高い
- スキーマ変更時の手順がシンプル
- この規模なら SQL 直接制御のメリットが大きい

**Negative:**

- 型付きヘルパーを自前で書く必要がある
- マイグレーション管理を自前で行う必要がある
