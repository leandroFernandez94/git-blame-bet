# Tasks: E2E Tests from Issues (#20 bootstrap)

## Phase 1: Bootstrap infrastructure (no deps)

- [x] 1.1 Wire root E2E scripts in `package.json` (`e2e`, `e2e:headed`). Done when commands run from repo root.
- [x] 1.2 Create `e2e/playwright.config.ts` with `playwright-bdd`, reporter, global setup/teardown, and local base URLs. Done when config resolves feature/step paths.
- [x] 1.3 Create `e2e/global/setup.ts` + `e2e/global/teardown.ts` to start/stop FE+BE with readiness checks. Done when teardown always closes spawned processes.
- [x] 1.4 Create `e2e/support/fixtures/fixture-route.ts` for `X-Mock-Fixture` injection. Done when `standard-repo` can be attached per test context.

## Phase 2: Backend fixture routing + production gating (depends: 1)

- [x] 2.1 Extend `packages/shared/src/types/messages.ts` with optional `fixtureId` on `lobby:create`. Done when old payloads stay valid.
- [x] 2.2 Update `backend/src/index.ts` to capture fixture header context for HTTP/WS paths. Done when missing header keeps normal flow.
- [x] 2.3 Update `backend/src/websocket/handler.ts` to resolve fixture precedence (payload > header) and bind `gameId -> fixtureId` on create. Done when only explicit values bind.
- [x] 2.4 Update `backend/src/game/engine.ts` + `backend/src/repo/processor.ts` + needed `backend/src/providers/*` to consume bound fixture deterministically. Done when unbound games use existing provider path.
- [x] 2.5 Add backend tests for precedence and gating. Done when cases cover payload/header/none and production-safe fallback.

## Phase 3: Frontend testability anchors (depends: 1)

- [x] 3.1 Add minimal critical `data-testid` in `frontend/src/pages/{Home,Join,Lobby,Playing,Results}Page.tsx` only where role/label is unstable. Done when names follow `page-element-intent` kebab-case.

## Phase 4: Base E2E framework (depends: 1,2,3)

- [x] 4.1 Create `e2e/support/session/Player.ts` with isolated BrowserContext lifecycle and fixture setup. Done when each player has independent context/state.
- [x] 4.2 Create `e2e/support/session/GameSession.ts` for two-player create/join/play/result orchestration. Done when API supports #20 without custom polling.
- [x] 4.3 Create `e2e/steps/gameplay.steps.ts` and wire `playwright-bdd` world/session lifecycle. Done when each Gherkin step maps to `GameSession` actions/assertions.

## Phase 5: Issue #20 scenario + acceptance checks (depends: 4)

- [x] 5.1 Create `e2e/features/gameplay/full-game.feature` for create, join, rounds, and final result with fixture `standard-repo`. Done when full happy path is explicit for two players.
- [x] 5.2 Implement auto-waiting assertions for multiplayer propagation and results. Done when happy path has no sleeps/manual polling.
- [x] 5.3 Add deterministic replay check for repeated local runs. Done when outcomes stay stable across consecutive executions.

## Phase 6: Documentation mirroring (depends: 2,3,5)

- [x] 6.1 Create `docs/e2e-decisions.md` mirroring: #20 first with bootstrap, fixture strategy B, selector strategy B. Done when doc includes rationale and `e2e/decisions` reference.
- [x] 6.2 Update developer testing docs with local E2E prerequisites and commands. Done when newcomer can run #20 locally without CI-only dependencies.

## Phase 7: Deferred follow-up (optional, after #20 green)

- [ ] 7.1 Define next checklist for #21 (join-existing-game + lobby propagation) reusing current framework. Done when no infra rebuild tasks appear.
- [ ] 7.2 Define next checklist for #22 (round sync + answer gating) reusing fixture binding and selector strategy B. Done when scope is scenario-level additions only.
