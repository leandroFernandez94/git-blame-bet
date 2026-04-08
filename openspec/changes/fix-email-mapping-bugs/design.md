# Design: Fix Email Mapping Bugs

## Technical Approach

Three targeted fixes in `azure-devops.ts` only — no interface changes, no generic pipeline changes. Fix the casing root cause (Bug #1/#4: `buildEmailMapEntries` iterates lowercased Map keys instead of contributors array), the pagination cap (Bug #2: 200 too low), and the case-sensitive authorMap (Bug #3: creates duplicate contributors). All fixes preserve the existing `GitProvider` interface and `Contributor` type.

## Architecture Decisions

### Decision: Iterate contributors array, not Map keys

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Iterate `this.contributorEmails` Map (current) | Lowercased keys become logins → case mismatch with `contributors[].login` | ❌ Rejected |
| Iterate `contributors` param, lookup via `contributorEmails.get(login.toLowerCase())` | Original-case login preserved; lowercased lookup into emails Map | ✅ Chosen |
| Collect emails from git log in `buildEmailMapEntries` (like GitHub) | Consistent with GitHub but duplicates git log parsing already in `buildEmailMap` | ❌ Rejected |

**Rationale**: `contributorEmails` is keyed by `displayName.toLowerCase()` (line 146). Iterating its entries produces lowercased logins. The fix iterates `contributors` (original-case `login`) and does a lowercased lookup into `contributorEmails`. This is the minimal fix — uses the parameter that was always there but ignored.

### Decision: Case-insensitive authorMap key

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Exact-case key (current) | Same person with "Leandro Fernandez" and "leandro fernandez" = two contributors | ❌ Rejected |
| Lowercased key, store original displayName in value | Same person merged; displayName preserved for display | ✅ Chosen |

**Rationale**: ADO doesn't have a `login` field — `displayName` IS the identity. The `contributorEmails` Map already lowercases correctly (line 146). `authorMap` should match. The value object already stores `displayName` (original case) separately from the key, so no display information is lost.

### Decision: Increase pagination cap to 1000

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Cap at 200 (current) | ~2 API pages, fast but misses contributors after commit 200 | ❌ Rejected |
| Cap at 1000 | ~10 API pages, slower but covers most repos | ✅ Chosen |
| Continuation-token pagination (uncapped) | Complete coverage but more complex; ADO API supports it | ⏳ Deferred |

**Rationale**: 1000 commits covers the vast majority of repos while keeping the change simple. Continuation-token pagination can be added later if needed. The env var `ADO_COMMIT_PAGINATION_CAP` remains configurable for users who need different limits.

## Data Flow

```
repo-processor.ts
  │
  ├── provider.getContributors(ref)
  │       │
  │       └── ADO: paginates commits API (up to 1000 ← FIX #2)
  │           ├─ authorMap: key = displayName.toLowerCase() ← FIX #3
  │           │  (same person merged regardless of casing)
  │           ├─ Returns: Contributor[] (login = displayName, ORIGINAL case)
  │           └─ Populates: this.contributorEmails { lowercased → Set<email> }
  │
  ├── buildEmailMap(repoPath, contributors, provider)
  │       │
  │       ├── Step 1: provider.buildEmailMapEntries(contributors, repoPath)
  │       │       │
  │       │       └── ADO: iterates contributors array ← FIX #1/#4
  │       │           for each contributor:
  │       │             emails = contributorEmails.get(login.toLowerCase())
  │       │             map.set(email, contributor.login)  ← original case!
  │       │
  │       ├── Step 2: git log parse (unchanged)
  │       └── Step 3: Name-group linking (unchanged, propagates original case)
  │
  └── line 77: c.login === snippet.blame.login
          ↑ now matches: both are original case
```

## File Changes

| File | Action | Lines | Description |
|------|--------|-------|-------------|
| `backend/src/providers/azure-devops.ts` | Modify | 5-8 | Increase `ADO_COMMIT_PAGINATION_CAP` default from 200 to 1000 |
| `backend/src/providers/azure-devops.ts` | Modify | 134, 138 | Use `displayName.toLowerCase()` as `authorMap` key |
| `backend/src/providers/azure-devops.ts` | Modify | 190-203 | Rewrite `buildEmailMapEntries` to iterate `contributors` param with lowercased email lookup |

## Interfaces / Contracts

No interface changes. `GitProvider`, `Contributor`, `EmailMap` all preserved.

**`buildEmailMapEntries` internal change** (same signature, different implementation):

```typescript
// Before: iterates this.contributorEmails (lowercased keys → lowercased logins)
for (const [displayName, emails] of this.contributorEmails) {
  for (const email of emails) {
    map.set(email, displayName);  // displayName is lowercased!
  }
}

// After: iterates contributors (original case), lowercased lookup
for (const contributor of contributors) {
  const emails = this.contributorEmails.get(contributor.login.toLowerCase());
  if (!emails) continue;
  for (const email of emails) {
    map.set(email, contributor.login);  // original case!
  }
}
```

**`authorMap` key change** (line 134, 138):

```typescript
// Before: exact-case key
const existing = authorMap.get(displayName);

// After: lowercased key (displayName preserved in value)
const key = displayName.toLowerCase();
const existing = authorMap.get(key);
// ...
authorMap.set(key, { displayName, avatarUrl: author.imageUrl ?? "", count: 1 });
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `buildEmailMapEntries` returns original-case logins | Set `contributorEmails` with lowercased keys, pass `Contributor[]` with mixed-case logins, assert map values use original case |
| Unit | `authorMap` merges same-name different-case | Mock ADO API with "Leandro Fernandez" + "leandro fernandez", assert single contributor returned |
| Unit | Pagination cap respects new default | Verify `ADO_COMMIT_PAGINATION_CAP` defaults to 1000, env override still works |
| Unit | Contributors beyond commit 200 are found | Mock API with 300+ commits, verify contributor from commit 250 is discovered |

## Migration / Rollout

No migration required. Purely algorithmic changes in one file. Rollback = revert `azure-devops.ts`.

## Open Questions

- [ ] None — all decisions resolved by exploration and proposal.
