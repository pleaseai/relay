---
name: Webhook implementation error handling patterns
description: Known silent failure locations and patterns in the multi-provider webhook implementation (relay-party.ts, providers/)
type: project
---

Key silent failure patterns found in the gainful-chartreuse branch webhook implementation:

1. **Auth bypass via missing secret** (`relay-party.ts:55-59`): When neither `ctx.storage.get('webhook_secret')` nor `env.WEBHOOK_SECRET` is set, the entire verification block is skipped with no log. All unauthenticated requests are accepted and broadcast.

2. **Handshake storage write unguarded** (`relay-party.ts:47`): `this.ctx.storage.put('webhook_secret', hookSecret)` is awaited with no try/catch. Durable Object storage failures throw and produce an unstructured 500 with no error code.

3. **Silent JSON parse swallow in extractMetadata** (`github.ts:23-25`, `asana.ts:40-42`): Both providers catch parse errors with empty `catch` blocks and return stub values (`event: 'unknown'`). Corrupted payloads broadcast as valid events with no log.

4. **request.text() unguarded** (`relay-party.ts:52`): Body read has no error handling; stream abort or size limit violation produces unstructured 500.

**Why:** This is a new implementation being built out in the gainful-chartreuse worktree. The error handling infrastructure (logging functions, errorIds) does not yet exist in this package — it is a fresh monorepo.

**How to apply:** When reviewing subsequent PRs in this worktree, expect these patterns may recur. The project has no `logError`/`logForDebugging` conventions yet — recommend establishing them before adding more providers.
