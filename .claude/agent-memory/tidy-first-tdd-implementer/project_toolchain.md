---
name: relay-server toolchain quirks
description: How to run vitest, eslint, and tsc in this monorepo given old system Node.js
type: project
---

System Node.js is v10 (too old for modern ESM tools). Bun is v1.3.10.

**Why:** The system PATH node binary is v10.16.0 which cannot run vitest or eslint directly.

**How to apply:**
- Run vitest: `bun run node_modules/vitest/vitest.mjs run <test-file>`
- Run eslint: `bun /path/to/repo/node_modules/.bin/eslint <file>`
- Run tsc: `bun x --bun tsc --noEmit` (bunx alone resolves the wrong tsc; use `--bun` flag)
- Install dev deps: `bun add -d <package> --ignore-scripts` (prepare script fails on old node)
