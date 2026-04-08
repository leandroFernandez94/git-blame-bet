# Proposal: Fix Email Mapping Bugs

## Intent

The ADO email mapping pipeline has 4 bugs causing duplicate contributors and ghost entries in gameplay. The root cause is `buildEmailMapEntries` iterating lowercased Map keys instead of the `contributors` array (original-case logins), compounded by a case-sensitive `authorMap` and a 200-commit pagination cap that leaves later contributors unmapped.

## Scope

### In Scope
- Fix `buildEmailMapEntries` to iterate `contributors` array and use `contributor.login` (original case) with lowercased lookup into `contributorEmails`
- Make `authorMap` case-insensitive (lowercase key) in `getContributors`
- Increase `ADO_COMMIT_PAGINATION_CAP` from 200 to 1000

### Out of Scope
- Removing `contributorEmails` hidden state (deferred — works once casing is fixed)
- ADO Identity API resolution
- Changes to GitHub provider, `git-blame.ts`, or `repo-processor.ts`

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `ado-contributor-enrichment`: Add requirement for case-insensitive `authorMap` and increased pagination coverage. Clarify that `buildEmailMapEntries` MUST use original-case `contributor.login` from the contributors array, not internal Map keys.

## Approach

Three targeted fixes in `azure-devops.ts` only:

1. **`buildEmailMapEntries`**: Iterate `_contributors` array instead of `contributorEmails` Map. For each contributor, lookup emails via `this.contributorEmails.get(contributor.login.toLowerCase())`. Map entries use `contributor.login` (original case) as the value — fixes Bug #1 and #4.

2. **`getContributors` — authorMap**: Use `displayName.toLowerCase()` as `authorMap` key (merge entries for same person with different casings) — fixes Bug #3.

3. **Pagination cap**: Increase `ADO_COMMIT_PAGINATION_CAP` from 200 to 1000 (10 API pages) — fixes Bug #2.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/providers/azure-devops.ts` | Modified | Fix casing in `buildEmailMapEntries`, make `authorMap` case-insensitive, increase pagination cap |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Two distinct humans with same name different casings get merged | Low | Acceptable: extremely rare, ADO displayName is canonical |
| Higher pagination = slower contributor loading (~10 API pages) | Low | Acceptable tradeoff for correct mapping; still bounded |
| Existing games use cached mappings | Low | Transient state; new games get correct data |

## Rollback Plan

Revert `backend/src/providers/azure-devops.ts` — all 3 fixes are in one file.

## Dependencies

- ADO PAT with code read access (already required, no new scopes)

## Success Criteria

- [ ] ADO contributor login in email map matches original case from `contributors` array
- [ ] No duplicate contributors caused by casing differences
- [ ] Contributors appearing after commit 200 are correctly mapped
- [ ] No same-person-twice in any game round
