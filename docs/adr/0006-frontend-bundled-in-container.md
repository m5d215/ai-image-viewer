---
id: "0006"
title: フロントエンドホスティング — 外部ホスティング不採用、コンテナ同梱
status: accepted
date: 2026-03-19
superseded_by: null
tags: ["architecture", "deployment", "frontend", "docker"]
---

# ADR-0006: フロントエンドホスティング — 外部ホスティング不採用、コンテナ同梱

## Context

フロントエンドだけCloudflare等でホスティングし、ローカルのバックエンドと通信させる構成を検討した。

## Decision

フロントエンドはバックエンドと同一コンテナから配信する。

## Alternatives

| 選択肢 | 利点 | 欠点 | 不採用理由 |
|--------|------|------|------------|
| Cloudflare Pages（フロント） + Cloudflare Tunnel or ポート開放（バックエンド通信） | CDN による高速配信、デプロイの分離 | ローカル API のインターネット公開によるセキュリティリスク、HTTPS → HTTP の mixed content ブロック | ローカルでサーバーを起動する時点でフロントも一緒に配信すれば済み、シングルユーザー・ローカル用途ではメリットが薄い |

## Consequences

**Positive:**

- ローカル API をインターネットに公開するセキュリティリスクがない
- HTTPS/HTTP の mixed content 問題を回避できる
- デプロイ構成がシンプル（コンテナ一つで完結）

**Negative:**

- CDN による配信最適化の恩恵が得られない（ローカル用途では問題にならない）
