# Spec: Migrate Test Runner to Vitest

## Overview

Replace the current `bun test` runner with Vitest across the relay monorepo. Vitest provides better IDE integration, coverage reporting, watch mode, and ecosystem compatibility while maintaining fast execution via Bun runtime.

## Goals

1. Install and configure Vitest at the monorepo root with workspace support.
2. Configure Vitest for each package (`relay-server`, `relay-client`) and app (`relay-worker`).
3. Set up coverage reporting (v8 or istanbul) with >80% threshold.
4. Ensure all existing tests pass under Vitest.
5. Update Turborepo `test` task to use Vitest.
6. Update CI configuration if applicable.

## Success Criteria

- `bun run test` runs Vitest across all workspaces via Turborepo.
- Coverage reports are generated and threshold enforcement is active.
- No test regressions — all existing tests pass.
- Developer experience: `vitest --watch` works per-package for local development.

## Constraints

- Must work with Bun as the runtime (not Node.js).
- Cloudflare Workers types must be compatible in test environment.
- No changes to existing test logic — only runner/config migration.
