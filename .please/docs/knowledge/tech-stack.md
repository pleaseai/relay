# Tech Stack — Relay

## Runtime & Language

- **TypeScript** 5.7+ — strict mode, ESNext target
- **Bun** 1.3 — package manager and local development runtime
- **Cloudflare Workers** — production edge runtime (no Node.js APIs)

## Monorepo

- **Turborepo** — task orchestration (`build`, `check`, `lint`, `test`, `dev`)
- **Bun workspaces** — `apps/*` and `packages/*`

## Frameworks & Libraries

- **PartyServer** 0.3 — Durable Object framework for per-room WebSocket state
- **PartySocket** 1.1 — auto-reconnecting WebSocket client
- **Wrangler** 4.x — Cloudflare Workers dev server and deployment CLI
- **consola** — structured logging (client-side)

## Testing

- **Vitest** — unit and integration test runner

## Code Quality

- **ESLint** 10 with `@antfu/eslint-config` — 2-space indent, single quotes, no semicolons
- **Husky** 9 + **lint-staged** 16 — pre-commit hook runs ESLint on staged files
- **commitlint** 20 with `@commitlint/config-conventional` — enforces conventional commits

## Release

- **release-please** — automated versioning, changelogs, and GitHub releases
