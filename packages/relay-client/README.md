# @pleaseai/relay-client

WebSocket relay client for webhook events.

Provides `RelayTransport` — an auto-reconnecting WebSocket client that connects to a cloud relay worker (see `apps/relay-worker`) so applications can receive webhook events without requiring a public inbound port.

## Usage

```ts
import { RelayTransport } from '@pleaseai/relay-client'

const transport = new RelayTransport(
  { url: 'relay.example.workers.dev', room: 'my-project', token: 'secret', secret: null },
  () => console.log('new event received'),
)

transport.connect()
```

## Development

```bash
# Install dependencies (from project root)
bun install

# Type check
bun run --filter @pleaseai/relay-client check

# Test
bun run --filter @pleaseai/relay-client test
```
