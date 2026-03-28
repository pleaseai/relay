# Adding a New Webhook Provider

## Overview

relay-server routes incoming webhooks to rooms using a provider pattern. Each
provider handles one webhook source (GitHub, Asana, etc.) and is automatically
available at `/webhook/<name>/:room` once registered.

## The WebhookProvider Interface

```ts
// src/providers/types.ts
interface WebhookProvider {
  name: string
  verify: (body: string, request: Request, secret: string) => Promise<boolean>
  extractMetadata: (body: string, request: Request) => { event: string, action: string | null }
  isHandshake: (request: Request) => boolean
}
```

| Method | Purpose |
|---|---|
| `verify` | Validate the request signature; return `false` to reject |
| `extractMetadata` | Return event type and optional action for routing |
| `isHandshake` | Return `true` if this is a one-time registration request (respond and skip relay) |

## Step-by-Step: Adding a Provider (e.g., Linear)

**1. Create `src/providers/linear.ts`**

```ts
import { computeHmacSha256, constantTimeCompare, WebhookProvider } from './types'

export const linearProvider: WebhookProvider = {
  name: 'linear',

  isHandshake: _request => false,

  verify: async (body, request, secret) => {
    const signature = request.headers.get('linear-signature')
    if (!signature)
      return false
    const hash = await computeHmacSha256(body, secret)
    return constantTimeCompare(hash, signature)
  },

  extractMetadata: (body, _request) => {
    try {
      const parsed = JSON.parse(body)
      return {
        event: parsed.type ?? 'unknown',
        action: parsed.action ?? null,
      }
    }
    catch {
      return { event: 'unknown', action: null }
    }
  },
}
```

**2. Register in `src/providers/index.ts`**

```ts
import { linearProvider } from './linear'

const providers: Record<string, WebhookProvider> = {
  asana: asanaProvider,
  github: githubProvider,
  linear: linearProvider, // add this
}

export { linearProvider } from './linear' // add this
```

**3. Add tests in `src/providers/linear.test.ts`**

Cover at minimum: valid signature, missing signature, invalid signature,
`extractMetadata` happy path, and any handshake logic.

The provider is now available at `/webhook/linear/:room`.

## Shared Utilities

Both helpers are exported from `src/providers/types.ts`:

- `computeHmacSha256(payload, secret)` — returns a hex-encoded HMAC-SHA256
  digest using the Web Crypto API (edge-runtime safe).
- `constantTimeCompare(a, b)` — XOR-based length-constant string comparison;
  always use this instead of `===` when comparing signatures.

## Existing Providers at a Glance

| Provider | Signature header | Format | Handshake |
|---|---|---|---|
| `github.ts` | `x-hub-signature-256` | `sha256=<hex>` | None |
| `asana.ts` | `x-hook-signature` | raw hex | `X-Hook-Secret` present; accepts empty-events heartbeat |

## Constraints

- **Edge runtime only** — use `crypto.subtle` (Web Crypto API). Node's
  `crypto` module is not available.
- **Constant-time comparison required** — always use `constantTimeCompare()`
  for signature checks to prevent timing attacks.
