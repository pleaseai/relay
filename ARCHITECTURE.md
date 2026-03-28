# Architecture

> This document describes the high-level architecture of the **relay** project.
> If you want to familiarize yourself with the codebase, this is a good place to start.

## Bird's-Eye View

Relay is a real-time WebSocket relay that bridges webhook-based services (GitHub, Asana, Linear, etc.) with connected clients. External services POST webhook payloads to a Cloudflare Worker, which routes them to a per-room Durable Object (PartyServer). The Durable Object verifies the webhook signature, strips the payload down to a lightweight envelope (metadata only — no raw body), and broadcasts it to all connected WebSocket clients in that room.

The system is split into three packages following a clear separation of concerns: a reusable server library, a reusable client library, and a deployment-specific worker app.

```
Webhook Source ──POST /webhook/:provider/:room──▶ relay-worker (Cloudflare Worker)
                                                │
                                                ▼
                                        RelayParty (Durable Object)
                                          │ verify signature
                                          │ build envelope
                                          │ broadcast
                                          ▼
                                  relay-client (WebSocket)
                                    │ deduplicate
                                    │ triggerRefresh()
                                    ▼
                              Consumer application
```

## Entry Points

If you want to understand the codebase, start here:

| # | File | What to look for |
|---|------|-----------------|
| 1 | `apps/relay-worker/src/index.ts` | The Cloudflare Worker fetch handler — routing logic for `/health`, `/webhook/:provider/:room`, and PartyKit WebSocket upgrade |
| 2 | `packages/relay-server/src/relay-party.ts` | `RelayParty` class — the Durable Object that handles `onConnect` (auth), `onRequest` (webhook ingestion + signature verification), and `broadcast` |
| 3 | `packages/relay-client/src/relay-transport.ts` | `RelayTransport` class — auto-reconnecting WebSocket client with event deduplication |
| 4 | `packages/relay-client/src/types.ts` | Shared type definitions: `RelayConfig` and `RelayEnvelope` |

## Module Structure

```
relay/
├── apps/
│   └── relay-worker/          # Cloudflare Worker deployment (private, not published)
│       ├── src/index.ts       #   Worker fetch handler — routes webhooks and WS connections
│       └── wrangler.json      #   Wrangler config — DO bindings, migrations
│
├── packages/
│   ├── relay-server/          # @pleaseai/relay-server (published library)
│   │   └── src/
│   │       ├── index.ts       #   Public exports: RelayParty, Env
│   │       └── relay-party.ts #   Durable Object: auth, signature verification, broadcast
│   │
│   └── relay-client/          # @pleaseai/relay-client (published library)
│       └── src/
│           ├── index.ts       #   Public exports: RelayTransport, types
│           ├── relay-transport.ts  #   WebSocket client with dedup + auto-reconnect
│           ├── types.ts       #   RelayConfig, RelayEnvelope interfaces
│           └── relay-transport.test.ts  #   Unit tests
│
├── turbo.json                 # Turborepo task definitions (build, check, lint, test, dev)
├── package.json               # Root workspace config, Bun 1.3, devDependencies
├── eslint.config.ts           # @antfu/eslint-config (2-space, single quotes, no semi)
├── commitlint.config.js       # Conventional commits enforcement
└── release-please-config.json # Automated releases for relay-client, relay-server
```

### `apps/relay-worker` — Cloudflare Worker

The deployment entry point. Not published to npm. Depends on `@pleaseai/relay-server` via workspace protocol.

**Routing logic** (`src/index.ts`):
- `GET /health` → health check response
- `POST /webhook/:provider/:room` → extracts provider and room from URL, sets `X-Relay-Provider` header, forwards to the room's Durable Object via `getServerByName`
- All other requests → `routePartykitRequest` for WebSocket upgrade handling
- Unmatched → 404

**Wrangler config** (`wrangler.json`):
- Durable Object binding: `RelayParty` class
- SQLite migration tag `v1` for the Durable Object

### `packages/relay-server` — Server Library

Exports `RelayParty`, a PartyServer `Server` subclass that acts as a Durable Object.

**Key behaviors**:
- **Hibernation**: `static options = { hibernate: true }` — DO hibernates when no connections are active
- **`onConnect`**: Authenticates clients via `?token=` query parameter against `AUTH_TOKEN` env var. Sends a `{ type: 'connected', room }` message on success.
- **`onRequest`**: Accepts only POST. Verifies GitHub-style `X-Hub-Signature-256` HMAC signature if `WEBHOOK_SECRET` is set. Parses the body for `action` field. Builds a lightweight envelope (`{ type, event_id, event, action, received_at }`) and broadcasts to all connections.
- **Signature verification**: Uses Web Crypto API (`crypto.subtle`) for HMAC-SHA256. Constant-time comparison to prevent timing attacks.

### `packages/relay-client` — Client Library

Exports `RelayTransport`, a WebSocket client built on `PartySocket` (auto-reconnect built-in).

**Key behaviors**:
- **Event deduplication**: Maintains a `Set<string>` of seen `event_id` values (max 100, FIFO eviction). Duplicate events are silently dropped.
- **Trigger callback**: On valid, non-duplicate message, calls `triggerRefresh()` — the consumer decides what to do.
- **Lifecycle**: `connect()` / `disconnect()` / `isConnected()` API. Idempotent — calling `connect()` twice is safe.
- **Logging**: Uses `consola` with `relay` tag for structured logging.

## Architecture Invariants

These are the rules that must not be violated. If a change would break one of these, it requires an ADR.

1. **Never broadcast unverified webhooks.** If `WEBHOOK_SECRET` is configured, every webhook must pass HMAC-SHA256 signature verification before broadcast. There is no "skip verification" mode.

2. **Envelopes are metadata-only.** The broadcast envelope contains `type`, `event_id`, `event`, `action`, and `received_at`. The raw webhook body is never forwarded to clients. This keeps WebSocket traffic minimal and avoids leaking sensitive payload data.

3. **Edge-runtime only.** All server-side code must run on Cloudflare Workers. No Node.js-specific APIs (`fs`, `net`, `child_process`, `Buffer` from `node:buffer`, etc.). Use Web Crypto API, not `crypto` from Node.

4. **Per-room isolation via Durable Objects.** Each room is a separate Durable Object instance. Rooms never share state. The room name is derived from the URL path (`/webhook/:provider/:room`).

5. **Client-side deduplication is mandatory.** The relay client must deduplicate events by `event_id` to handle reconnection scenarios where events may be replayed. The dedup cache has a bounded size (currently 100).

6. **Constant-time signature comparison.** Signature verification must use constant-time comparison (bitwise XOR loop) to prevent timing attacks. Do not use `===` for signature strings.

## Cross-Cutting Concerns

### Error Handling

- **Server**: Returns structured JSON errors with `{ error: { code, message } }` format and appropriate HTTP status codes (400, 401, 404, 405).
- **Client**: Logs errors via `consola` and relies on PartySocket's auto-reconnect. Invalid JSON messages are logged and silently dropped — they never crash the client.

### Authentication & Authorization

- **WebSocket clients**: Authenticate via `?token=` query parameter, validated against `AUTH_TOKEN` environment variable. Unauthorized connections are closed with code `4001`.
- **Webhook sources**: Authenticated via `X-Hub-Signature-256` HMAC header, validated against `WEBHOOK_SECRET` environment variable. Currently GitHub-format only.

### Testing

- Test runner: Vitest
- Tests live alongside source files (`*.test.ts` co-located pattern)
- `relay-client` has unit tests with mocked PartySocket
- `relay-server` tests are planned (currently type-check only)
- Turborepo orchestrates test runs across all packages: `bun run test`

### Logging

- Client-side: `consola` with `relay` tag — structured, leveled logging
- Server-side: `console.error` for critical failures (e.g., body parse errors)

### Release & Versioning

- `release-please` automates versioning and changelogs for `relay-client` and `relay-server`
- Follows semantic versioning with `bump-minor-pre-major` (pre-1.0 minor bumps for features)
- `relay-worker` is private and not versioned via release-please

### Code Style

- ESLint with `@antfu/eslint-config`: 2-space indent, single quotes, no semicolons
- Conventional commits enforced by commitlint + Husky pre-commit hooks
- lint-staged runs ESLint on `*.{ts,tsx,js,mjs}` files
