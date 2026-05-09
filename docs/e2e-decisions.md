# E2E Decisions Mirror (#20 bootstrap)

This document mirrors the locked E2E decisions tracked in engram topic `e2e/decisions`.

Arquitectura aplicada y flujo operativo: [`./e2e-architecture.md`](./e2e-architecture.md)

## Scope First

- First milestone is issue **#20** only (bootstrap + first deterministic playable path).
- Do not expand to #21/#22/#24 scenarios until #20 baseline is stable.

## Locked Decisions

### 1) E2E topology

- Use a root-level `e2e/` workspace with Playwright + `playwright-bdd`.
- Keep real frontend/backend runtime for fidelity with WebSocket behavior.

### 2) Fixture strategy B

- Use **header + explicit fixture↔game binding**.
- Header: `X-Mock-Fixture` for deterministic test context routing.
- Explicit binding: optional `fixtureId` in `lobby:create` payload, persisted to game context.
- Test-only gating MUST remain active (`E2E_FIXTURE_ROUTING`), with normal provider flow when disabled.

### 3) Selector strategy B

- Prefer role/label/text selectors first.
- Add minimal critical `data-testid` only for unstable dynamic nodes.
- Naming convention: `page-element-intent` in kebab-case (example: `lobby-start-game`, `results-podium-first`).

## Current Baseline Notes

- Bootstrap includes Playwright config, BDD glue, and global setup/teardown lifecycle.
- Base abstractions started with `GameSession` and `Player` for isolated contexts.
- `standard-repo` deterministic fixture is currently the only fixture in this batch.
