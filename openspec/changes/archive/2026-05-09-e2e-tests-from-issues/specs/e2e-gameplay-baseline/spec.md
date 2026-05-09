# e2e-gameplay-baseline Specification

## Purpose

Define the first executable E2E baseline for multiplayer gameplay from issue #20, including environment bootstrap, deterministic fixtures, and local execution criteria.

## Requirements

### Requirement: E2E environment bootstrap

The system MUST provide a root-level `e2e/` test harness using Playwright with `playwright-bdd`, global setup/teardown, and deterministic fixture selection through `X-Mock-Fixture`.

#### Scenario: Bootstrap assets are present and wired
- GIVEN a fresh repository checkout
- WHEN the E2E baseline is initialized for this change
- THEN root `e2e/` assets MUST include Playwright config, BDD feature/step support, and global setup/teardown entry points
- AND test execution MUST use those entry points without requiring CI-specific services

#### Scenario: Fixture is selected per test context
- GIVEN an E2E test tagged or configured to use fixture `standard-repo`
- WHEN the test creates browser traffic for backend calls
- THEN requests MUST carry `X-Mock-Fixture: standard-repo`
- AND backend fixture routing MUST remain inactive when the header is absent

### Requirement: Multiplayer test model

The system MUST model each player with an isolated BrowserContext and provide `Player` and `GameSession` abstractions for multi-user orchestration.

#### Scenario: Player isolation
- GIVEN two players in one game session
- WHEN both players interact concurrently
- THEN each player MUST run in a separate BrowserContext with independent session state
- AND actions from one player SHALL be observable to the other only through application behavior (UI/WebSocket), not shared browser storage

#### Scenario: Synchronization with Playwright auto-waiting
- GIVEN asynchronous state propagation between players
- WHEN a step waits for UI/WebSocket-driven updates
- THEN assertions SHOULD rely on Playwright auto-waiting expectations as primary synchronization
- AND custom polling MUST NOT be required for the happy path

### Requirement: Issue #20 full-game flow scenario

The system MUST implement one deterministic two-player full-game E2E scenario mapped to issue #20 from game creation to final result visibility.

#### Scenario: Full game happy path
- GIVEN fixture `standard-repo` and two players ready to participate
- WHEN player A creates a game, player B joins, rounds are played, and the game completes
- THEN both players MUST observe consistent game progression and completion
- AND at least one final result view MUST be validated for determinism

#### Scenario: Deterministic replay
- GIVEN the same fixture and scenario inputs
- WHEN the #20 scenario is executed repeatedly on a local machine
- THEN outcomes MUST be reproducible without manual timing tuning
- AND flaky timing-dependent assertions SHOULD be treated as failures

### Requirement: Local end-to-end executability

The system MUST make issue #20 executable end-to-end in local development without CI dependency.

#### Scenario: Local-only execution path
- GIVEN local backend and frontend runtime prerequisites are available
- WHEN a developer runs the documented E2E command(s)
- THEN the #20 scenario MUST execute against real frontend/backend processes with mocked provider data
- AND the workflow MUST NOT require CI-only environment variables, orchestration, or remote services

## Acceptance Criteria

1. A developer can run #20 E2E locally from repository scripts and obtain pass/fail output.
2. The executed flow covers create game, join game, multiplayer progression, and game completion.
3. Fixture determinism is controlled via `X-Mock-Fixture` and produces stable results for repeated runs.
4. The baseline architecture is extensible to #21, #22, and #24 without replacing the core harness model.

## Non-Goals (Increment 1)

- Implementing all fixture variants from #28–#33.
- Resolving product-policy decisions for single-contributor, insufficient-snippets, unsupported-language, or tie handling.
- Adding CI pipeline integration, performance benchmarking, or load testing.
