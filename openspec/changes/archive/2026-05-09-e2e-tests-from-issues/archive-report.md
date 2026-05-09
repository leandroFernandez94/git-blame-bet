# Archive Report: e2e-tests-from-issues

## Final Status

- **Change**: `e2e-tests-from-issues`
- **Archive date**: `2026-05-09`
- **Baseline target**: Issue **#20**
- **Final verdict input**: **PASS WITH WARNINGS** (no critical issues)
- **Archive decision**: **ARCHIVED (warnings accepted as non-blocking)**

## Scope Delivered

Delivered and archived for #20 baseline:

1. Root E2E harness using Playwright + `playwright-bdd` under `e2e/`.
2. Global setup/teardown for local FE/BE runtime lifecycle.
3. Deterministic fixture routing with `X-Mock-Fixture` and game-level fixture binding strategy.
4. Multiplayer abstractions (`Player`, `GameSession`) with BrowserContext-per-player isolation model.
5. Full deterministic two-player game happy path scenario for issue #20.
6. Deterministic replay check (`--repeat-each=2`) validated in verification.
7. Documentation updates for E2E decisions and local execution.

## Accepted Warnings (Non-Blocking)

1. No explicit E2E assertion yet for storage/session boundary isolation (cookies/localStorage) beyond structural evidence of separate contexts.
2. Deferred checklist planning tasks remain open in original tasks (7.1 for #21, 7.2 for #22).
3. Minor design/file-change drift: deterministic behavior implemented primarily in processor/fixture modules while design table referenced provider file changes.

These warnings are accepted for this archive because behavior is verified, there are no critical failures, and risks are explicitly carried forward.

## Deferred Next Steps (Carry-Forward)

- **#21 follow-up change**: define and implement join-existing-game + lobby propagation checklist using current harness.
- **#22 follow-up change**: define and implement round synchronization + answer gating checklist using current fixture binding strategy.
- **Optional hardening**: add one isolation-focused E2E assertion verifying cross-player browser storage/session separation.

## Spec Sync Summary

| Domain | Action | Details |
|---|---|---|
| `e2e-gameplay-baseline` | Created | New main spec copied from delta (`78` lines). |

Source of truth updated:
- `openspec/specs/e2e-gameplay-baseline/spec.md`

## Traceability (Engram Observation IDs)

- Proposal: `sdd/e2e-tests-from-issues/proposal` → **#182**
- Spec: `sdd/e2e-tests-from-issues/spec` → **#183**
- Design: `sdd/e2e-tests-from-issues/design` → **#185**
- Tasks: `sdd/e2e-tests-from-issues/tasks` → **#188**
- Apply Progress: `sdd/e2e-tests-from-issues/apply-progress` → **#192**
- Verify Report: `sdd/e2e-tests-from-issues/verify-report` → **#195**

## OpenSpec Archive Location

- `openspec/changes/archive/2026-05-09-e2e-tests-from-issues/`

## Completion

The SDD cycle for `e2e-tests-from-issues` is complete for #20 baseline and is now archived with explicit follow-up work queued for subsequent changes.
