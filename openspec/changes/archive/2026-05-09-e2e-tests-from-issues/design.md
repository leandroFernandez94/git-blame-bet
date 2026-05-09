# Design: E2E Tests from Issues (#20 bootstrap)

## Technical Approach

Build a root `e2e/` Playwright + `playwright-bdd` workspace that runs real local frontend/backend and mocks provider data deterministically. For issue #20, deliver one two-player happy path with fixture `standard-repo`, using **fixture strategy B** (header + explicit fixture↔game binding) and **selector strategy B** (accessible selectors first + minimal `data-testid` at unstable critical points).

## Architecture Decisions

| Decision | Options | Tradeoff | Chosen |
|---|---|---|---|
| E2E topology | Root `e2e/` vs colocated tests | Root has more setup but cleaner FE/BE orchestration | Root `e2e/` |
| Runtime fidelity | Real FE+BE vs mocked backend | Real runtime is slower but validates WS and phase transitions | Real FE+BE |
| Multiplayer isolation | Same context vs context-per-player | Separate contexts cost more resources but avoid session leakage | Context-per-player |
| Fixture strategy | Header-only vs header+binding (A/B) | Header-only is simpler but weak for WS/game lifecycle | **B: header + explicit fixture↔game binding** |
| Selector strategy | Role-only vs hybrid (A/B) | Role-only is cleaner but brittle on dynamic UI nodes | **B: role-first + targeted `data-testid`** |

## Data Flow

```
Feature -> Steps -> GameSession -> Player A/B (isolated contexts)
        -> FE HTTP + WS (/ws) -> backend websocket handler -> engine/processRepo
        -> fixture resolver (header + game fixture binding) -> fixture provider
```

Fixture strategy B runtime flow (explicit binding point):
1. `Player.setFixture("standard-repo")` installs request routing that adds `X-Mock-Fixture` on backend-bound HTTP traffic.
2. On `lobby:create`, test payload carries optional `fixtureId`; backend also has access to ws-upgrade-derived header context.
3. Backend resolves fixture (payload wins, else header), then stores `gameId -> fixtureId` immediately after game creation.
4. `engine.handleStartLoading()` reads bound fixture from game context and selects deterministic provider path.
5. If no binding exists, backend falls back to normal provider behavior (no production impact).

This makes fixture choice stable across HTTP + WS phases, not only initial requests.

## E2E Workspace Architecture

| Path | Responsibility |
|---|---|
| `e2e/playwright.config.ts` | Global setup/teardown, reporter, BDD glue |
| `e2e/global/setup.ts` + `e2e/global/teardown.ts` | Start/stop FE+BE and readiness checks |
| `e2e/features/gameplay/full-game.feature` | #20 scenario |
| `e2e/steps/gameplay.steps.ts` | Steps mapped to `GameSession` API |
| `e2e/support/session/{GameSession,Player}.ts` | Multiplayer orchestration |
| `e2e/support/fixtures/fixture-route.ts` | Header injection + fixture helper |
| `e2e/fixtures/standard-repo/*.json` | Deterministic data |
| `docs/e2e-decisions.md` | Mirror of locked E2E decisions + link to engram topic `e2e/decisions` |

## Interfaces / Contracts

```ts
type FixtureId = "standard-repo";

type LobbyCreatePayload = {
  repoUrl: string;
  nickname: string;
  azureDevOpsToken?: string;
  fixtureId?: FixtureId; // test-only optional
};

interface FixtureBindingStore {
  bind(gameId: string, fixtureId: FixtureId): void;
  get(gameId: string): FixtureId | undefined;
}
```

Selector strategy B guidance:
- Default to `getByRole`/`getByLabel`/`getByText` with stable accessible names.
- Add `data-testid` **only** for critical unstable nodes (dynamic/loading/transient elements).
- Naming: `kebab-case`, semantic and page-scoped: `page-element-intent` (e.g., `lobby-start-game`, `playing-loading-progress`, `results-podium-first`).
- Avoid testids for static headings/buttons that already have stable role+name.

## File Changes

| File | Action | Description |
|---|---|---|
| `openspec/changes/e2e-tests-from-issues/design.md` | Modify | Lock resolved decisions and runtime fixture binding flow |
| `backend/src/index.ts` | Modify | Capture ws/header fixture context for test-mode routing |
| `backend/src/websocket/handler.ts` | Modify | Bind fixture to game during `lobby:create` |
| `backend/src/game/engine.ts` | Modify | Consume game-bound fixture in loading path |
| `backend/src/repo/processor.ts` + `backend/src/providers/*` | Modify | Deterministic fixture-aware provider execution |
| `packages/shared/src/types/messages.ts` | Modify | Optional `fixtureId` in `lobby:create` payload |
| `frontend/src/pages/{Home,Join,Lobby,Playing,Results}Page.tsx` | Modify | Add minimal critical-path `data-testid` anchors only where needed |
| `docs/e2e-decisions.md` | Create | Repository mirror of E2E decisions, synced with engram `e2e/decisions` |

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Fixture resolver precedence and fallback | Payload vs header vs none branches |
| Integration | Game fixture binding consumed by loading/provider pipeline | Engine + processor deterministic checks |
| E2E | #20 full game, 2 players | Gherkin flow + role-first selectors + targeted testids |

## Migration / Rollout

No production migration required. Rollout remains: #20 bootstrap first, then #21/#22/#24, then fixture matrix expansion (#28–#33).

## Open Questions / Residual Risks

- [x] Fixture strategy locked: **B**.
- [x] Selector strategy locked: **B**.
- [x] Repo documentation mirroring required via `docs/e2e-decisions.md` + engram `e2e/decisions`.
- [ ] Residual risk: test-only fixture hooks must stay gated (no accidental production enablement).
