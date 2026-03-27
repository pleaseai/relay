# @pleaseai/relay

WebSocket relay for webhook events. Receives webhook POST requests from GitHub, Asana, Linear (and more), and broadcasts lightweight event notifications to connected clients over WebSocket.

## Packages

| Package | Description |
|---------|-------------|
| [`@pleaseai/relay-server`](packages/relay-server) | PartyServer Durable Object — receives webhooks, verifies signatures, broadcasts envelopes |
| [`@pleaseai/relay-client`](packages/relay-client) | Auto-reconnecting WebSocket client with event deduplication |
| [`@pleaseai/relay-worker`](apps/relay-worker) | Cloudflare Worker deployment (private, not published) |

## Quick Start

```bash
# Install dependencies
bun install

# Development
bun run dev

# Type check
bun run check

# Test
bun run test

# Lint
bun run lint
```

## Architecture

```
Webhook Source ──POST /webhook/:room──> relay-worker (Cloudflare)
                                               |
                                        RelayParty (DO)
                                               |
                                       broadcast envelope
                                               |
                                   relay-client (WebSocket)
```

## License

FSL-1.1-MIT
