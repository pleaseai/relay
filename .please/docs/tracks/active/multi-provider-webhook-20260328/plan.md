# Plan: Multi-Provider Webhook Support

> Track: multi-provider-webhook-20260328
> Spec: [spec.md](./spec.md)

## Overview

- **Source**: [spec.md](./spec.md)
- **Issue**: TBD
- **Created**: 2026-03-28
- **Approach**: Clean Architecture (Provider Pattern)

## Purpose

After this change, webhook sources beyond GitHub (starting with Asana) will be able to send events through the relay. Operators can verify it works by POSTing to `/webhook/github/:room` or `/webhook/asana/:room` and seeing the envelope broadcast to connected WebSocket clients with a `provider` field identifying the source.

## Context

The relay-server currently has GitHub-specific webhook handling hardcoded into `RelayParty.onRequest`: signature verification via `X-Hub-Signature-256`, event type from `x-github-event` header, and action from the JSON body. The product vision calls for supporting multiple webhook providers (GitHub, Asana, Linear, etc.), but there is no abstraction layer for provider-specific logic.

Asana webhooks differ significantly from GitHub. Asana uses a two-phase flow: an initial handshake where Asana sends `X-Hook-Secret` and the server must echo it back, followed by ongoing events signed with `X-Hook-Signature` (HMAC-SHA256 using the handshake secret). This means the Durable Object must persist the secret received during handshake — unlike GitHub where the secret is a static environment variable. The DO already has SQLite storage enabled (wrangler.json migration tag `v1`), so this is feasible without infrastructure changes.

The URL pattern changes from `/webhook/:room` to `/webhook/:provider/:room`. The worker extracts the provider name and passes it to the Durable Object via an `X-Relay-Provider` custom header. This keeps room names clean and provider-agnostic for WebSocket clients.

Key constraints: edge-runtime only (Web Crypto API), constant-time signature comparison, metadata-only envelopes, per-room isolation via Durable Objects.

Non-goals: Linear support (future track), header-based auto-detection, per-provider env var secrets, webhook payload storage.

## Architecture Decision

The chosen approach is a **Provider Pattern** within `relay-server`. A `WebhookProvider` interface defines `verify()`, `extractMetadata()`, and `isHandshake()` methods. Concrete implementations (`GitHubProvider`, `AsanaProvider`) encapsulate provider-specific logic. A `resolveProvider()` function maps provider name strings to implementations.

The worker routes `/webhook/:provider/:room` by extracting the provider segment and forwarding it via `X-Relay-Provider` header to the Durable Object. Inside `RelayParty.onRequest`, the provider is resolved and delegates verification and metadata extraction. For Asana's handshake, the provider's `isHandshake()` returns true, the secret is stored in DO SQLite, and the handshake response is returned immediately without broadcasting.

Signature secrets follow a layered strategy: `this.ctx.storage.get('webhook_secret')` first (for Asana's dynamic secret), falling back to `this.env.WEBHOOK_SECRET` (for GitHub's static secret). Shared utilities (constant-time compare, HMAC-SHA256 computation) are extracted into a `crypto-utils.ts` module.

The `RelayEnvelope` type gains a `provider` field so clients can filter events by source.

## Tasks

- [ ] T001 Define WebhookProvider interface and crypto utilities (file: packages/relay-server/src/providers/types.ts)
- [ ] T002 [P] Extract GitHubProvider from existing relay-party logic (file: packages/relay-server/src/providers/github.ts) (depends on T001)
- [ ] T003 [P] Implement AsanaProvider with handshake and signature verification (file: packages/relay-server/src/providers/asana.ts) (depends on T001)
- [ ] T004 Create provider registry and resolver (file: packages/relay-server/src/providers/index.ts) (depends on T002, T003)
- [ ] T005 Refactor RelayParty to use provider pattern (file: packages/relay-server/src/relay-party.ts) (depends on T004)
- [ ] T006 Update worker routing for /webhook/:provider/:room (file: apps/relay-worker/src/index.ts) (depends on T005)
- [ ] T007 Add provider field to RelayEnvelope (file: packages/relay-client/src/types.ts)
- [ ] T008 Write provider implementation guide (file: packages/relay-server/PROVIDERS.md) (depends on T004)

## Key Files

### Create

- `packages/relay-server/src/providers/types.ts` — WebhookProvider interface, CryptoUtils
- `packages/relay-server/src/providers/github.ts` — GitHubProvider implementation
- `packages/relay-server/src/providers/asana.ts` — AsanaProvider implementation with handshake
- `packages/relay-server/src/providers/index.ts` — Provider registry, resolveProvider()
- `packages/relay-server/PROVIDERS.md` — Provider implementation guide

### Modify

- `packages/relay-server/src/relay-party.ts` — Refactor onRequest to delegate to providers, add secret storage
- `packages/relay-server/src/index.ts` — Export provider types
- `apps/relay-worker/src/index.ts` — New URL pattern, X-Relay-Provider header
- `packages/relay-client/src/types.ts` — Add provider field to RelayEnvelope

### Reuse

- `apps/relay-worker/wrangler.json` — SQLite storage already configured (no changes needed)

## Verification

### Automated Tests

- [ ] GitHubProvider.verify() passes with valid HMAC-SHA256 signature
- [ ] GitHubProvider.verify() rejects invalid/missing signatures
- [ ] GitHubProvider.extractMetadata() extracts event and action
- [ ] AsanaProvider.isHandshake() detects X-Hook-Secret header
- [ ] AsanaProvider.verify() passes with valid X-Hook-Signature
- [ ] AsanaProvider.verify() rejects invalid signatures
- [ ] AsanaProvider.extractMetadata() extracts resource_type and action from events array
- [ ] resolveProvider() returns correct provider for known names
- [ ] resolveProvider() throws for unknown provider names
- [ ] Worker routes /webhook/github/room correctly
- [ ] Worker routes /webhook/asana/room correctly
- [ ] Worker returns 400 for /webhook/unknown/room

### Observable Outcomes

- After POSTing a GitHub webhook to `/webhook/github/test-room`, connected clients receive an envelope with `provider: 'github'`
- After completing Asana handshake at `/webhook/asana/test-room`, the DO stores the secret and responds with `X-Hook-Secret`
- Running `bun run test` shows all provider tests passing
- Running `bun run check` shows no type errors

### Acceptance Criteria Check

- [ ] AC-1: GitHub webhook flow works via /webhook/github/:room
- [ ] AC-2: Asana webhooks verified and broadcast via /webhook/asana/:room
- [ ] AC-3: Asana handshake returns proper X-Hook-Secret response
- [ ] AC-4: Unknown provider returns 400
- [ ] AC-5: Unit tests for each provider
- [ ] AC-6: Unit tests for routing
- [ ] AC-7: Provider guide documented
- [ ] AC-8: All quality gates pass

## Decision Log

- Decision: Use URL path segment (`/webhook/:provider/:room`) for provider routing
  Rationale: Keeps room names clean, WebSocket clients remain provider-agnostic, explicit routing over magic detection
  Date/Author: 2026-03-28 / Claude

- Decision: Store Asana webhook secret in DO SQLite storage
  Rationale: Asana's handshake sends X-Hook-Secret dynamically (not pre-configured). DO already has SQLite enabled. Layered lookup: storage first, env var fallback.
  Date/Author: 2026-03-28 / Claude

- Decision: Pass provider name via X-Relay-Provider header from worker to DO
  Rationale: Worker already parses URL; avoids polluting room name with provider prefix; clean separation between routing (worker) and handling (DO)
  Date/Author: 2026-03-28 / Claude
