# Multi-Provider Webhook Support

> Track: multi-provider-webhook-20260328

## Overview

Refactor the relay-server webhook handling from GitHub-only to a provider-based architecture. Extract the current GitHub-specific logic into a provider interface, add Asana webhook support, and route requests via URL path segments (`/webhook/:provider/:room`). This enables the single relay-worker to handle webhooks from multiple sources while keeping each provider's verification and metadata extraction logic isolated.

## Requirements

### Functional Requirements

- [ ] FR-1: Define a `WebhookProvider` interface with `verify(body, request, secret)` and `extractMetadata(body, request)` methods
- [ ] FR-2: Extract current GitHub webhook logic into a `GitHubProvider` implementing the interface (signature verification via `X-Hub-Signature-256`, metadata from `x-github-event` header)
- [ ] FR-3: Implement `AsanaProvider` with Asana-specific signature verification (`X-Hook-Secret` handshake, `X-Hook-Signature` HMAC-SHA256) and metadata extraction
- [ ] FR-4: Change webhook URL pattern from `/webhook/:room` to `/webhook/:provider/:room`
- [ ] FR-5: `RelayParty.onRequest` delegates to the resolved provider for verification and metadata extraction
- [ ] FR-6: Provider resolution from URL path segment with clear error for unknown providers
- [ ] FR-7: Support Asana webhook handshake (respond with `X-Hook-Secret` header on initial verification request)

### Non-functional Requirements

- [ ] NFR-1: All signature verification must use constant-time comparison (existing invariant)
- [ ] NFR-2: Edge-runtime compatible only (Web Crypto API, no Node.js APIs)
- [ ] NFR-3: Provider interface must be simple enough for adding new providers in <50 lines

## Acceptance Criteria

- [ ] AC-1: Existing GitHub webhook flow works identically via `/webhook/github/:room`
- [ ] AC-2: Asana webhooks are verified and broadcast correctly via `/webhook/asana/:room`
- [ ] AC-3: Asana handshake request (`X-Hook-Secret`) returns proper response
- [ ] AC-4: Unknown provider returns `400` with descriptive error
- [ ] AC-5: Unit tests exist for each provider's verify and extractMetadata
- [ ] AC-6: Unit tests for provider resolution and routing
- [ ] AC-7: Provider implementation guide documented
- [ ] AC-8: All quality gates pass (test, check, lint, coverage >= 80%)

## Out of Scope

- Linear webhook support (future track)
- Header-based auto-detection of providers
- Webhook payload storage or replay
- Per-provider secret management (single `WEBHOOK_SECRET` env var for now)

## Assumptions

- Asana sends `X-Hook-Secret` on initial handshake and `X-Hook-Signature` on subsequent events
- Each provider uses the same shared `WEBHOOK_SECRET` environment variable (per-provider secrets can be added later)
- The `/webhook/:room` legacy URL is removed (breaking change, acceptable pre-1.0)
