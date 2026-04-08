# Tasks: Improve Email Mapping for Azure DevOps

## Phase 1: ADO Contributor Email Capture

- [x] 1.1 Add `private contributorEmails: Map<string, Set<string>> = new Map()` to `AzureDevOpsProvider` class in `backend/src/providers/azure-devops.ts` (after line 41). Key = `displayName.toLowerCase()`, value = Set of emails.
- [x] 1.2 In `getContributors` (`azure-devops.ts`, inside the `for (const commit of commits)` loop at line 128), after the `authorMap.set`/`existing.count++` block, capture `author.email` if present: normalize to lowercase, add to `this.contributorEmails` under `displayName.toLowerCase()`. Skip if `author.email` is null/undefined/empty.
- [x] 1.3 Clear `this.contributorEmails` at the start of `getContributors` (before the pagination loop) so repeated calls don't accumulate stale data.

## Phase 2: Rewrite ADO buildEmailMapEntries

- [x] 2.1 Replace the entire body of `buildEmailMapEntries` in `azure-devops.ts` (lines 184-235). Remove the git log parsing, name-matching, and prefix-matching heuristics.
- [x] 2.2 New implementation: iterate `this.contributorEmails` entries. For each `displayName → Set<email>`, set `map.set(email.toLowerCase(), displayName)` for every email in the set. Return the map. Remove the try/catch and git subprocess call entirely.

## Phase 3: Remove Rank-Match + Add Unmatched Logging

- [x] 3.1 Delete the rank-match fallback block in `backend/src/utils/git-blame.ts` (lines 80-138 — from `// 4. Rank-based unmatched fallback` to the closing `}` of the `if` block). This removes: `gitLogEmails`, `reallyMatchedLogins`, `unmatchedContributors`, `unmatchedEmails`, `emailToName`, `nameGroupCounts`, `rankedUnmatchedAuthors`, and the rank-match loop.
- [x] 3.2 After the name-group linking block (after line 78) and before the existing catch block (line 139), add unmatched email logging: collect emails from `emailCommitCounts` that are not in `map`, log each with `[blame-map] Unmatched email: {email} ({count} commits)`. Only log if there are unmatched emails.

## Phase 4: Testing

- [ ] 4.1 Unit test `AzureDevOpsProvider.getContributors` populates `contributorEmails` correctly: mock ADO commits API response with multiple authors and multiple emails per author. Assert the instance map has correct associations.
- [ ] 4.2 Unit test `AzureDevOpsProvider.buildEmailMapEntries` uses direct email lookup: set `contributorEmails` on the instance, call `buildEmailMapEntries`, assert correct `email → login` mappings. Verify no git subprocess is invoked.
- [ ] 4.3 Unit test `buildEmailMap` no longer rank-matches: construct contributors + git log scenario where old code would have rank-matched. Assert those emails remain unmapped (login = null).
- [ ] 4.4 Unit test `buildEmailMap` name-group linking still works: same author.name emails where one is matched by provider entries — assert the other gets linked.
- [ ] 4.5 Unit test unmatched emails are logged: spy on `console.log`, verify `[blame-map] Unmatched email:` lines appear for unmapped entries.
