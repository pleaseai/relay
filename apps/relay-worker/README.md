# @pleaseai/relay-worker

Cloudflare Worker that relays webhook events to clients via WebSocket.

When applications run behind a firewall or NAT (e.g., on a developer laptop), they cannot receive incoming webhooks directly. This worker acts as a cloud-hosted relay: it receives webhook `POST` requests, verifies their signatures, and broadcasts event notifications to all connected clients over WebSocket.

## How It Works

```
Webhook Source ──POST /webhook/:provider/:room──> Cloudflare Worker (RelayParty)
                                               |
                                               v
                                      Durable Object per room
                                               |
                                       broadcast via WebSocket
                                               |
                          +--------------------+--------------------+
                          v                    v                    v
                      Client A             Client B             Client C
```

1. **Webhook ingress** — `POST /webhook/:provider/:room` extracts the provider and room from the URL, sets `X-Relay-Provider` header, and forwards to the `RelayParty` Durable Object identified by `room`.
2. **Signature verification** — If `WEBHOOK_SECRET` is set, the worker validates `X-Hub-Signature-256` using constant-time HMAC-SHA256 comparison.
3. **Broadcast** — The Durable Object broadcasts a lightweight envelope (`event`, `action`, `event_id`, `received_at`) to all connected WebSocket clients. The full payload is **not** forwarded.
4. **Client connection** — Clients connect via `partysocket` (`RelayTransport` in `@pleaseai/relay-client`) to `wss://<worker>/parties/relay-party/:room`.

## Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check — returns `{ "status": "ok" }` |
| `POST` | `/webhook/:provider/:room` | Webhook ingress — resolves provider, forwards to the Durable Object for `:room` |
| `GET` | `/parties/relay-party/:room` | WebSocket upgrade for relay clients |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WEBHOOK_SECRET` | No | Webhook secret for HMAC-SHA256 signature verification |
| `AUTH_TOKEN` | No | Token required for WebSocket connections (passed as `?token=` query param) |

## Development

```bash
# Install dependencies (from project root)
bun install

# Start local dev server
bun run --filter @pleaseai/relay-worker dev

# Type check
bun run --filter @pleaseai/relay-worker check
```

## Deployment

```bash
bun run --filter @pleaseai/relay-worker deploy
```

Configure secrets with:

```bash
wrangler secret put WEBHOOK_SECRET
wrangler secret put AUTH_TOKEN
```
