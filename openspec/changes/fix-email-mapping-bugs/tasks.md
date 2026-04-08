# Tasks: Fix Email Mapping Bugs

## Phase 1: Core Bug Fixes (azure-devops.ts)

- [ ] 1.1 Change `ADO_COMMIT_PAGINATION_CAP` default from `"200"` to `"1000"` on line 6 — fixes pagination cutoff at 200 commits
- [ ] 1.2 Make `authorMap` case-insensitive: change `authorMap.get(displayName)` → `authorMap.get(displayName.toLowerCase())` and `authorMap.set(displayName, ...)` → `authorMap.set(displayName.toLowerCase(), ...)` on lines 134/138 — merges same-person different-casing entries
- [ ] 1.3 Rewrite `buildEmailMapEntries` (lines 190–203): iterate `_contributors` array instead of `this.contributorEmails` Map keys; lookup emails via `this.contributorEmails.get(contributor.login.toLowerCase())`; set each email → `contributor.login` (original case)

## Phase 2: Manual Verification

- [ ] 2.1 Run game with ADO repo having >200 commits — verify contributors beyond 200 appear
- [ ] 2.2 Run game with author using mixed-case displayName — verify single entry, original-case login in email map
- [ ] 2.3 Run game and confirm no ghost/duplicate contributors in any round
