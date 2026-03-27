# Workflow — Relay

## Development Principles

### Test-Driven Development (TDD)
All feature code follows RED-GREEN-REFACTOR:
1. **RED**: Write a failing test that defines the desired behavior
2. **GREEN**: Write the minimum code to pass the test
3. **REFACTOR**: Clean up while keeping tests green

### High Code Coverage
- Target: **>80%** line coverage
- All public APIs must have corresponding tests
- Edge cases and error paths must be tested

### Small, Focused Commits
- One commit per completed task
- Conventional commit messages enforced by commitlint
- Each commit should leave the codebase in a working state

## Standard Task Lifecycle

1. **Understand** — Read the spec/plan, identify acceptance criteria
2. **Test First** — Write failing tests for the task
3. **Implement** — Write minimum code to pass tests
4. **Refactor** — Clean up, extract, simplify
5. **Verify** — Run full test suite + type check + lint
6. **Commit** — Stage and commit with conventional message

## Quality Gates

Before marking any task complete:
- [ ] All tests pass (`bun run test`)
- [ ] Type check passes (`bun run check`)
- [ ] Lint passes (`bun run lint`)
- [ ] Code coverage >= 80%

## Phase Completion Protocol

When all tasks in a phase are complete:
1. Run full quality gates
2. Wait for user verification before proceeding to next phase
3. Update checkpoint state

## Development Commands

| Command | Purpose |
|---------|---------|
| `bun install` | Install dependencies |
| `bun run dev` | Start development server (wrangler) |
| `bun run build` | Build all packages |
| `bun run test` | Run tests (vitest) |
| `bun run check` | TypeScript type checking |
| `bun run lint` | Run ESLint |
| `bun run lint:fix` | Auto-fix lint issues |
