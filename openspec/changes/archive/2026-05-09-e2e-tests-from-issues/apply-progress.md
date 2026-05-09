# Apply Progress: e2e-tests-from-issues (Batch 1)

## Completed in this batch

- ✅ 1.1 Root e2e scripts in workspace `package.json` (`e2e`, `e2e:headed`) with bddgen + playwright command chain.
- ✅ 1.2 `e2e/playwright.config.ts` with `playwright-bdd` integration, reporter, global setup/teardown.
- ✅ 1.3 `e2e/global/setup.ts` + `e2e/global/teardown.ts` with FE/BE process lifecycle and readiness checks.
- ✅ 1.4 `e2e/support/fixtures/fixture-route.ts` for `X-Mock-Fixture` injection per browser context.
- ✅ 2.1 Optional `fixtureId` added to `lobby:create` payload types.
- ✅ 2.2 Backend WS upgrade now captures `X-Mock-Fixture` header context.
- ✅ 2.3 Fixture precedence (payload > header) and explicit game binding wiring added in websocket flow.
- ✅ 2.5 Backend unit tests added for fixture precedence + test-only gating.
- ✅ 3.1 Minimal critical selector anchors (`data-testid`) added in Home/Join/Lobby/Playing/Results pages.
- ✅ 4.1 Base `Player` abstraction with isolated BrowserContext lifecycle.
- ✅ 4.2 Base `GameSession` abstraction with two-player orchestration helpers.
- ✅ 4.3 Base BDD step wiring via `e2e/steps/gameplay.steps.ts`.
- ✅ 6.1 Created `docs/e2e-decisions.md` mirroring locked strategy decisions.

## Partial / intentionally deferred

- ⏳ 2.4 remains open: deterministic fixture currently resolved in engine for `standard-repo`, but full processor/provider-path consumption per task definition is still pending.
- ⏳ 5.1 remains open: `full-game.feature` scaffold added, but full end-to-end rounds-to-results happy path is not fully encoded yet.
- ⏳ 5.2, 5.3, 6.2, 7.1, 7.2 remain pending by scope.

## Validation run

- `backend`: `bunx vitest run src/e2e/fixture-context.test.ts` → **pass (3 tests)**

---

# Apply Progress: e2e-tests-from-issues (Batch 2)

## Completed in this batch

- ✅ 2.4 Deterministic fixture consumption moved into processor path with engine wiring (`engine -> processRepo(..., fixtureId)`), keeping provider pipeline fallback when fixture is absent or routing disabled.
- ✅ 5.1 Completed full #20 feature flow from create/join/start through all deterministic rounds and final results.
- ✅ 5.2 Strengthened multiplayer auto-waiting assertions for lobby propagation, round visibility, transitions, and results (no sleeps/manual polling in scenario path).
- ✅ 5.3 Added deterministic replay verification by running the same #20 scenario with `--repeat-each=2` and validating stable pass outcomes.
- ✅ 6.2 Updated `README.md` with local E2E prerequisites and run commands for full suite, targeted #20 scenario, and deterministic replay check.

## Additional fixes required to execute #20 baseline locally

- Added `e2e/package.json` with `"type": "module"` to keep E2E global scripts in ESM mode.
- Added `e2e/tsconfig.json` for local E2E TypeScript resolution.
- Updated `e2e/global/process-state.ts` to use `fileURLToPath(new URL('.', import.meta.url))` instead of `import.meta.dir` for Node compatibility.

## Validation run

- `backend`: `bunx vitest run src/e2e/fixture-context.test.ts src/repo/processor.fixture.test.ts` → **pass (5 tests)**
- `e2e`: `bun run e2e -- --grep "Two players complete full deterministic game and reach stable results"` → **pass (1 test)**
- `e2e replay`: `bun run e2e -- --grep "Two players complete full deterministic game and reach stable results" --repeat-each=2` → **pass (2/2 runs)**
