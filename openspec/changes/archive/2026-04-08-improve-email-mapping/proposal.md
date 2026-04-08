# Proposal: Improve Email Mapping for Azure DevOps

## Intent

The `buildEmailMap` algorithm in `git-blame.ts` has a broken "rank-match" fallback that incorrectly assigns commits to wrong users in Azure DevOps repos. ADO contributors use `displayName` as login (e.g., "Leandro Fernandez") which never matches email prefixes, so rank-match pairs unmatched emails with unmatched contributors by commit-count rank — zero semantic relationship, producing false positives that corrupt the game (wrong author shown as correct answer).

## Scope

### In Scope
- Remove the rank-match fallback from `buildEmailMap` (lines 80-138 of `git-blame.ts`)
- Enrich ADO `getContributors` to capture `author.email` from the commits API response (already available, currently discarded)
- Build ADO `buildEmailMapEntries` that maps emails → displayName using the enriched contributor data
- Log unmatched emails for observability (already partially done in `snippet-extractor.ts`)

### Out of Scope
- ADO Identity API resolution (`/_apis/identities?searchFilter=MailAddress`) — deferred as optional enhancement
- Changes to GitHub provider (works correctly)
- Changes to `Contributor` type or shared types
- UI changes to display unmatched email diagnostics

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- None (no existing `openspec/specs/` directory — capabilities tracked via engram artifacts)

## Approach

**Phase 1 — Remove rank-match fallback (eliminates false positives):**
Delete the entire rank-match block (lines 80-138) from `buildEmailMap`. This is the source of incorrect mappings. Generic name-group linking (step 3) stays — it's correct.

**Phase 2 — Enrich ADO contributor data (free data, no extra API calls):**
ADO `getContributors` already receives `author.email` in the commits API response (line 119 of `azure-devops.ts`) but discards it. Capture it alongside `displayName` and `avatarUrl` in an internal map, then expose it to `buildEmailMapEntries` so emails can be directly matched to contributors without heuristics.

**Phase 3 (optional, deferred) — ADO Identity API:**
For remaining unmatched emails, call `GET /_apis/identities?searchFilter=MailAddress&filterValue={email}`. Requires PAT with identity scope. Deferred due to rate-limit and scope uncertainty.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/utils/git-blame.ts` | Modified | Remove rank-match fallback (lines 80-138) |
| `backend/src/providers/azure-devops.ts` | Modified | Capture `author.email` in `getContributors`; rewrite `buildEmailMapEntries` to use enriched data |
| `backend/src/game/snippet-extractor.ts` | Unchanged | Already logs unmatched emails — no changes needed |
| `backend/src/game/repo-processor.ts` | Unchanged | `pickDistractors` works with corrected data — no changes needed |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Snippet pool reduction after removing rank-match | Medium | Acceptable: fewer-but-correct snippets > more-but-wrong snippets. Oversample factor (5x) provides buffer. |
| ADO emails differ across commits for same author (e.g., corporate vs personal) | Low | Name-group linking (step 3 in `buildEmailMap`) already handles this. |
| ADO commits API doesn't always include `author.email` | Low | ADO API docs confirm email is present for authenticated commits. Fallback: skip commits without email. |

## Rollback Plan

Revert the two modified files (`git-blame.ts`, `azure-devops.ts`). The rank-match code is self-contained in `buildEmailMap` and can be restored atomically.

## Dependencies

- ADO PAT with code read access (already required — no new scopes for Phase 1-2)
- Phase 3 (Identity API) would require `vso.identity` scope

## Success Criteria

- [ ] Zero rank-match log lines appear for ADO repos (rank-match code is removed)
- [ ] ADO contributor emails from commits API are captured and used in email map
- [ ] No snippet attributed to wrong author (manual verification with known ADO repo)
- [ ] Snippet pool remains >= 20 for typical ADO repos with 3+ active contributors
