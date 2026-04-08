# Exploration: fix-email-mapping-bugs

## Current State

The email mapping pipeline for Azure DevOps has a multi-step flow:

1. `AzureDevOpsProvider.getContributors()` fetches commits from ADO API (capped at 200), builds `authorMap` keyed by exact-case `displayName`, populates `contributorEmails` Map keyed by **lowercased** displayName
2. `AzureDevOpsProvider.buildEmailMapEntries()` iterates `contributorEmails` (lowercased keys) and creates `email → login` mappings where login IS the lowercased key
3. `buildEmailMap()` merges provider entries, runs git log for ALL commits, does name-group linking
4. `matchContributorLogin()` looks up emailMap, then falls back to name-match and email-prefix-match
5. `repo-processor.ts:77` does exact match `c.login === snippet.blame.login`

## Confirmed Bugs

### Bug #1 (P0) — Case mismatch cascade

- `contributorEmails` Map key: lowercased displayName (e.g. `"leandro fernandez"`)
- `buildEmailMapEntries` returns this lowercased key as the login value
- `repo-processor.ts:77` exact match: `c.login` (`"Leandro Fernandez"`) !== lowercased (`"leandro fernandez"`)
- Creates ghost contributor with lowercased name; real contributor appears as distractor → **same person twice per round**
- Root cause: `buildEmailMapEntries` ignores `_contributors` param (original-case logins) and iterates the lowercased Map instead
- Also: `buildEmailMap` name-group linking propagates lowercased login to all matched emails → amplifies the problem

**Evidence:**
- `azure-devops.ts:146` — `const key = displayName.toLowerCase();`
- `azure-devops.ts:196-199` — `map.set(email, displayName)` where `displayName` is the lowercased Map key
- `repo-processor.ts:77-78` — `contributors.find((c) => c.login === snippet.blame.login)`

### Bug #2 (P1) — Pagination cap at 200 commits

- `ADO_COMMIT_PAGINATION_CAP` defaults to 200 (`azure-devops.ts:6`)
- ADO API only fetches 200 commits, but `git log --all` in buildEmailMap processes ALL commits
- Contributors only present after commit 200 have no email→login mapping
- Their snippets get skipped (blame.login = null) → reduced snippet pool

### Bug #3 (P2) — Case-sensitive authorMap creates duplicate contributors

- `authorMap.get(displayName)` uses exact-case key (`azure-devops.ts:134`)
- `"Leandro Fernandez"` and `"leandro fernandez"` create separate contributors
- Both appear in game as distinct players → **same human counted twice**
- `contributorEmails` Map DOES lowercase correctly, but `authorMap` doesn't

### Bug #4 (design) — `buildEmailMapEntries` ignores contributors parameter

- Signature: `buildEmailMapEntries(_contributors: Contributor[], _repoPath: string)`
- Both params are unused — reads from `this.contributorEmails` (lowercased keys) instead
- Should iterate the contributors array to get original-case logins, then look up emails by lowercased key
- This is the architectural root cause of Bug #1

## Affected Areas

| File | Why it's affected |
|------|-------------------|
| `backend/src/providers/azure-devops.ts` | `getContributors` (authorMap casing, pagination cap), `buildEmailMapEntries` (ignores contributors param, uses lowercased Map keys) |
| `backend/src/utils/git-blame.ts` | `buildEmailMap` (name-group linking propagates wrong-case logins), `matchContributorLogin` (comparison logic) |
| `backend/src/game/repo-processor.ts` | Exact match comparison at line 77 |
| `backend/src/game/snippet-extractor.ts` | Skips snippets when `blame.login` is null (affected by Bug #2) |

## Approaches

### 1. Targeted Fix (Bug #1, #3, #4)

Fix the two Map key casing issues directly:

- In `buildEmailMapEntries`: iterate `_contributors` array, use `contributor.login` (original case), look up emails via `contributorEmails.get(contributor.login.toLowerCase())`
- In `getContributors`: use case-insensitive key for `authorMap`

| Aspect | Detail |
|--------|--------|
| Pros | Minimal changes, fixes all 4 bugs at root cause, no API changes |
| Cons | Doesn't address pagination cap (Bug #2) |
| Effort | Low |

### 2. Targeted Fix + Pagination Cap Increase (All Bugs)

Same as #1, plus:

- Increase `ADO_COMMIT_PAGINATION_CAP` to 1000 (or make configurable via env)

| Aspect | Detail |
|--------|--------|
| Pros | Fixes all confirmed bugs |
| Cons | More API calls (10 pages instead of 2), still arbitrary cap |
| Effort | Low-Medium |

### 3. Full Refactor — Remove contributorEmails Hidden State

Same as #2, plus:

- Remove `this.contributorEmails` Map entirely
- Collect emails directly in `buildEmailMapEntries` from git log (like GitHub provider does)

| Aspect | Detail |
|--------|--------|
| Pros | Eliminates hidden state in provider, consistent approach with GitHub provider |
| Cons | Duplicates git log parsing (already done in buildEmailMap), larger refactor |
| Effort | Medium |

## Comparison

| Approach | Fixes Bug #1 | Fixes Bug #2 | Fixes Bug #3 | Fixes Bug #4 | Risk | Effort |
|----------|:---:|:---:|:---:|:---:|------|--------|
| 1. Targeted | ✅ | ❌ | ✅ | ✅ | Low | Low |
| 2. Targeted + Cap | ✅ | ✅ | ✅ | ✅ | Low | Low-Medium |
| 3. Full Refactor | ✅ | ✅ | ✅ | ✅ | Medium | Medium |

## Recommendation

**Approach 2** — targeted fixes for all 4 bugs with pagination cap increase.

- Fixes the root cause (casing) without unnecessary refactoring
- ADO commits API already returns email data, just needs correct casing passthrough
- Pagination cap increase is a simple config/env change
- GitHub provider works correctly because it has a real `login` field from the API; ADO's login IS the displayName, so casing matters

## Risks

- Existing games in progress would use old mappings (transient, not a real risk)
- Higher pagination cap = more ADO API calls and slower contributor loading
- Case-insensitive authorMap merge: if two different humans share the same name with different casings, they'd incorrectly merge (very rare edge case, acceptable)

## Ready for Proposal

Yes — all bugs are confirmed with line-level evidence. The fix is straightforward and low-risk.
