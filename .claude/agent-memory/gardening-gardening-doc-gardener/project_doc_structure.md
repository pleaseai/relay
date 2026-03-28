---
name: Project doc structure patterns
description: Naming conventions, index files, and recurring staleness patterns found in the relay repo documentation
type: project
---

## Repository doc layout

- Root-level: `README.md`, `ARCHITECTURE.md`
- Per-package: `packages/relay-server/README.md`, `packages/relay-client/README.md`, `apps/relay-worker/README.md`
- Provider guide: `packages/relay-server/PROVIDERS.md`
- Please workspace: `.please/INDEX.md`, `.please/docs/knowledge/`, `.please/docs/tracks/`, `.please/docs/decisions/`

## Knowledge docs (`.please/docs/knowledge/`)

These four files are loaded as AI context but are **not linked from any navigation doc**. They are internal context, not user-facing — orphan warnings on them are expected and can be ignored in future runs:
- `product.md`, `product-guidelines.md`, `tech-stack.md`, `workflow.md`

## Recurring staleness pattern (2026-03-28 run)

The multi-provider-webhook feature (track `multi-provider-webhook-20260328`) changed the webhook URL pattern from `/webhook/:room` to `/webhook/:provider/:room`. This change was reflected in code but **not** in 6 documentation files. Watch for this pattern on future URL/routing changes.

**Files that were stale and fixed:**
- `README.md` (diagram)
- `ARCHITECTURE.md` (diagram, entry point table, routing description, invariant #4, test runner note)
- `apps/relay-worker/README.md` (diagram, step 1 description, routes table)
- `.please/docs/knowledge/product.md` (diagram)
- `.please/docs/knowledge/product-guidelines.md` (API design section)

## Broken link fixed (2026-03-28 run)

`.please/INDEX.md` referenced `../CLAUDE.md` which does not exist. Fixed to plain text with note "not yet created".

## CLAUDE.md status

`CLAUDE.md` does not exist at the repo root as of 2026-03-28. The `.please/INDEX.md` reference was changed to plain text.

**Why:** The `.please` plugin may generate `CLAUDE.md` via `/standards:init` — it has not been run in this repo yet.
**How to apply:** If `CLAUDE.md` is created, restore the link in `.please/INDEX.md`.
