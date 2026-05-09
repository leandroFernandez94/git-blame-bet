# Exploration: e2e-tests-from-issues

## Current State

- The monorepo currently has backend/frontend/shared workspaces, but **no E2E harness**: there is no `e2e/` folder, no Playwright dependencies, and no BDD wiring.
- Backend/game flow is already real-time and event-driven (`lobby:create`, `lobby:join`, `game:start`, `round:answer`), which is suitable for full integration tests.
- Repository processing currently uses real providers and has no `X-Mock-Fixture` header handling yet.
- Constants are production-oriented (`ROUND_TIME_MS=15000`, `ROUNDS_COUNT=20`), so E2E requires controlled test config to avoid long/flake-prone runs.

## Affected Areas

- `backend/src/index.ts` — HTTP entrypoint; likely place to pass mock fixture selector (`X-Mock-Fixture`) into provider behavior.
- `backend/src/repo/processor.ts` + `backend/src/providers/*` — fixture-based provider behavior and deterministic fixture data loading.
- `backend/src/websocket/handler.ts` + `backend/src/game/engine.ts` — multi-player synchronization/disconnection behavior under test.
- `frontend/src/pages/*` + `frontend/src/context/GameContext.tsx` — user-observable states/assertions for lobby, rounds, and leaderboard.
- `packages/shared/src/types/messages.ts` — canonical WS contract for Playwright assertions.
- `package.json` (root/workspaces) — add Playwright + `playwright-bdd` tooling.
- `e2e/` (new root folder by decision) — config, features, steps, fixtures, page objects, session abstractions, global setup/teardown.

## Approaches

1. **Issue-first strict sequence: fixture issue (#29) before scenario issue (#20)**
   - Pros: clean dependency chain; fixture concern separated.
   - Cons: first delivered issue would not validate an end-to-end game flow; delays proof of architecture.
   - Effort: Medium.

2. **Scenario-first with bootstrap bundle in #20 (recommended)**
   - Pros: aligns with issue #20 intent (“primer test”, “resuelve toda la infraestructura”); delivers runnable vertical slice quickly; satisfies mandatory rule that first issue includes full E2E environment setup.
   - Cons: #20 becomes larger and must absorb minimal fixture work otherwise tracked in #29.
   - Effort: Medium-High.

3. **Infra-only first pseudo-issue, then #20**
   - Pros: smallest technical risk per PR.
   - Cons: does not map cleanly to current GitHub issue set; creates planning overhead and weak product signal.
   - Effort: Medium.

## Recommendation

**Recommended first issue: #20** (`feat(e2e): two players complete a full game`).

Justification:
- #20 explicitly declares itself as the first implementation and infrastructure resolver.
- It is the smallest issue that forces all architectural decisions into real execution: Playwright + BDD, two isolated players (BrowserContext-per-player), game session abstractions, deterministic fixture routing, and real backend/frontend lifecycle.
- It yields the highest confidence baseline for Tier 2/Tier 3 because it validates the complete happy path from lobby to final leaderboard.

**Important scope note:** the first issue implementation MUST include complete E2E environment setup tasks (not only the scenario):
- root `e2e/` scaffolding and Playwright config
- `playwright-bdd` feature/step glue
- global setup/teardown for shared server lifecycle
- base Page Objects + `GameSession` + `Player`
- mock fixture selector plumbing via `X-Mock-Fixture`
- minimum viable deterministic fixture (subset of #29 “standard-repo”) required for #20 to run reliably

## Dependency / Ordering Analysis

### Hard blockers
1. **Environment bootstrap blockers** (no Playwright/Bdd infra exists yet).
2. **Fixture determinism blockers** (no fixture switching via header yet).

### Scenario blockers
- #21 depends on base infra and stable lobby/game creation from #20.
- #22/#24 depend on #20 abstractions and stable multi-player orchestration.
- #25 may require test-time shorter round durations (configurable timer).
- #27 depends on tie fixture (#31).
- #32/#33 expose product/validation decisions and should run after happy path baseline.

### Practical first batch sequence
1. **#20 (expanded scope)** — bootstrap + one deterministic fixture + full-game happy path.
2. **#21** — join existing game/lobby propagation (reuses same abstractions).
3. **#22** — round synchronization and answer gating.
4. **#24** — disconnection/reconnection mid-game.
5. **Fixture consolidation pass** — complete remaining fixture issues #28–#33 incrementally, prioritizing #30 then #33.

## Risks

- **Scope creep risk in #20** if fixture work is not constrained to minimum viable data.
- **Flakiness risk** from real timers and asynchronous WS events; must rely on Playwright auto-waiting and deterministic test fixtures.
- **Contract drift risk** if page-object abstractions overfit first scenario; keep APIs small and composable.
- **Missing OpenSpec config risk**: `openspec/config.yaml` is absent, so no project-specific SDD rule overrides are currently discoverable.

## Ready for Proposal

Yes — enough evidence exists to proceed with a concrete proposal that formalizes #20-expanded scope, explicit dependency cuts, and a phased first batch.
