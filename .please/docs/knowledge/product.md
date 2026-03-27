# Product Guide — Relay

## Vision

Relay is a real-time WebSocket relay that bridges webhook-based services (GitHub, Asana, Linear, etc.) with connected clients. It receives webhook POST requests, verifies their signatures, and broadcasts lightweight event envelopes over WebSocket — enabling instant, low-latency event notifications without polling.

## Target Users

- **Internal tooling (pleaseai)**: AI agents and automation pipelines that need real-time awareness of external events (PR created, issue updated, task completed).
- **Developer tools**: CLI tools, IDE extensions, and dashboards that subscribe to project events.

## Core Features

1. **Webhook Ingestion** — Accept POST requests from multiple webhook providers at `/webhook/:room` endpoints.
2. **Signature Verification** — Validate webhook authenticity per provider (HMAC, etc.) before processing.
3. **Event Broadcasting** — Relay verified events as lightweight envelopes to all WebSocket clients connected to the matching room.
4. **Auto-reconnecting Client** — Provide a client library with automatic reconnection and event deduplication.
5. **Durable Object Hosting** — Run on Cloudflare Workers using PartyServer Durable Objects for per-room state isolation.

## Architecture Overview

```
Webhook Source ──POST /webhook/:room──> relay-worker (Cloudflare)
                                               |
                                        RelayParty (DO)
                                               |
                                       broadcast envelope
                                               |
                                   relay-client (WebSocket)
```

## Package Structure

| Package | Scope | Purpose |
|---------|-------|---------|
| `@pleaseai/relay-server` | Public | PartyServer Durable Object — webhook receipt, signature verification, envelope broadcast |
| `@pleaseai/relay-client` | Public | Auto-reconnecting WebSocket client with event deduplication |
| `@pleaseai/relay-worker` | Private | Cloudflare Worker deployment entry point |

## Constraints

- Must run on Cloudflare Workers (edge runtime, no Node.js APIs).
- Webhook signature verification is mandatory — never broadcast unverified events.
- Envelope payloads should be minimal (metadata only, not full webhook body) to keep WebSocket traffic lightweight.
- License: FSL-1.1-MIT.
