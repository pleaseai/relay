# Product Guidelines — Relay

## Code Style

- **Language**: TypeScript (strict mode) targeting ESNext.
- **Formatting**: 2-space indent, single quotes, no semicolons (enforced via @antfu/eslint-config).
- **Linting**: ESLint with `@antfu/eslint-config` — run `bun run lint` before committing.
- **Commits**: Conventional Commits enforced by commitlint (`@commitlint/config-conventional`).

## API Design

- Webhook endpoints follow the pattern `POST /webhook/:room`.
- Event envelopes are JSON objects containing metadata (source, event type, timestamp, room) — never the raw webhook body.
- WebSocket messages use a consistent envelope schema across all providers.

## Naming Conventions

- Packages: `@pleaseai/relay-*` scoped naming.
- Files: kebab-case for filenames, PascalCase for class/type exports.
- Branches: `<username>/<slug>` pattern.

## Quality Standards

- All webhook handlers must verify signatures before processing.
- Client library must handle reconnection and deduplication transparently.
- Edge-runtime compatible: no Node.js-only APIs (fs, net, child_process, etc.).
- Type-safe: avoid `any`; prefer explicit types and discriminated unions for event envelopes.

## Documentation

- Each package maintains its own README with usage examples.
- Public API changes require updated documentation.
- Architecture decisions are recorded in `.please/docs/decisions/`.
