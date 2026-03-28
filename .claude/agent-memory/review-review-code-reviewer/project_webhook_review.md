---
name: Multi-provider webhook review patterns
description: Architecture invariants, confirmed fixes, and open issues from the gainful-chartreuse webhook feature review (iteration 1 completed)
type: project
---

Key findings from the multi-provider webhook feature review (branch: gainful-chartreuse):

**Confirmed fixes (do not re-flag):**
- No-secret bypass: relay-party.ts now returns 500 when no secret configured
- constantTimeCompare length oracle: now iterates Math.max length, XORs 0 for missing chars
- Handshake fallthrough: now returns 400

**Open issues (flagged in iteration 1):**
1. Asana heartbeat broadcasts unverified: `verify()` returns true for `{events:[]}` with no signature, and the envelope is still broadcast. Architecture invariant: never broadcast unverified webhooks.
2. Room name not validated before `getServerByName`: path-traversal-style segments (e.g. `..`) can reach the DO router. Should validate room against `/^[\w-]{1,128}$/`.

**Why:** Edge-runtime only, no Node crypto. Web Crypto API (crypto.subtle) is the correct approach and is used throughout.

**How to apply:** In iteration 2 review, verify the heartbeat-bypass fix routes heartbeats to a 200 response without broadcasting, and that room validation was added in the worker.
