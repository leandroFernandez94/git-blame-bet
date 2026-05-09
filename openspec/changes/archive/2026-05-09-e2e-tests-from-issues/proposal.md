# Proposal: E2E Tests from Issues

## Intent

Establish a reliable end-to-end (E2E) test baseline for `git-blame-bet` using the issue set, starting with issue **#20** as the first executable vertical slice. This is needed now because the repo has real multiplayer flow but no E2E harness, so regressions across backend/frontend/WebSocket behavior are currently unguarded.

## Scope

### In Scope
- Deliver issue **#20** as the first implementation, explicitly expanded to include full E2E environment bootstrap.
- Preserve authoritative E2E decisions from `e2e/decisions`: Playwright + `playwright-bdd`, BrowserContext-per-player (`Player`), `GameSession`, global setup/teardown, fixture-switching header, root `e2e/`, real backend/frontend with provider mock.
- Add minimum deterministic fixture support required for #20 (`X-Mock-Fixture` plumbing + minimal fixture data).
- Define dependency-ordered rollout for next issues (#21, #22, #24, fixture consolidation #28–#33).

### Out of Scope
- Completing every fixture variant in #28–#33 during #20.
- Solving product-policy edge decisions from #32/#33 in this first slice.
- Performance/load benchmarking.

## Capabilities

### New Capabilities
- `e2e-gameplay-baseline`: Root E2E harness + deterministic full-game multiplayer happy-path validation.

### Modified Capabilities
- None.

## Approach

Implement scenario-first with bootstrap bundled into #20. Use real app runtime (frontend + backend), mock only provider data via deterministic fixtures selected with `X-Mock-Fixture`, and encode player orchestration through reusable page/session abstractions.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` (root/workspaces) | Modified | Add Playwright/BDD tooling and scripts |
| `e2e/` | New | Config, features, steps, fixtures, page objects, sessions |
| `backend/src/index.ts` | Modified | Fixture selector header plumbing |
| `backend/src/repo/processor.ts` + `backend/src/providers/*` | Modified | Deterministic provider fixture routing |
| `backend/src/websocket/handler.ts`, `backend/src/game/engine.ts` | Modified | Stability hooks/assertable behavior for E2E |

## Phased Plan (Dependency Order)

1. **#20 Expanded Bootstrap (mandatory first):** tooling + root `e2e/` + global setup/teardown + `playwright-bdd` glue + `GameSession`/`Player` + `X-Mock-Fixture` + minimum fixture + full-game happy path.
2. **#21:** join-existing-game and lobby propagation.
3. **#22:** round synchronization and answer gating.
4. **#24:** disconnect/reconnect flow.
5. **Fixture Consolidation:** remaining fixture issues #28–#33 (priority: #30 then #33).

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| #20 scope creep | Med | Freeze #20 to minimum viable fixture + one happy path |
| Async/WebSocket flakiness | Med | Deterministic fixtures, Playwright auto-wait, explicit sync checkpoints |
| Abstraction overfitting | Low-Med | Keep `Player`/`GameSession` APIs minimal, extend only when next issue requires |

## Rollback Plan

Revert E2E scaffolding and fixture-plumbing commits for #20, keeping production flow untouched by guarding test-only fixture routing behind explicit header usage.

## Dependencies

- Playwright and `playwright-bdd` tooling.
- Existing monorepo backend/frontend startup scripts.

## Success Criteria

- [ ] Issue #20 is first delivered issue and includes complete E2E environment setup (not scenario-only).
- [ ] A deterministic two-player full-game E2E test passes reliably against real backend/frontend with provider mock.
- [ ] Foundation supports immediate follow-up implementation of #21, #22, and #24 without re-architecting harness primitives.
