# Design: Improve Email Mapping for Azure DevOps

## Technical Approach

Two-part change: (1) eliminate the rank-match fallback in `buildEmailMap` that creates false-positive author assignments, and (2) enrich ADO contributor data with emails already present in the commits API so `buildEmailMapEntries` can do direct email→login mapping instead of heuristics. No interface changes, no shared type changes.

## Architecture Decisions

### Decision: Instance property for email-to-login associations

**Choice**: Add `private contributorEmails: Map<string, Set<string>>` to `AzureDevOpsProvider` — maps `displayName.toLowerCase()` → Set of emails.
**Alternatives**: (a) Change `Contributor` type to include emails — rejected: spec says no shared type changes. (b) Return a tuple from `getContributors` — rejected: breaks `GitProvider` interface. (c) Pass data via method parameter to `buildEmailMapEntries` — rejected: breaks `GitProvider` interface signature.
**Rationale**: The call flow in `repo-processor.ts` guarantees `getContributors(ref)` runs before `buildEmailMapEntries(contributors, repoPath)` on the same provider instance (lines 44 then 59). Instance property is the only option that preserves both interfaces while sharing data between methods.

### Decision: Remove rank-match block entirely (lines 80-138)

**Choice**: Delete the entire block — no config flag, no dead code.
**Alternatives**: (a) Feature flag to disable — rejected: YAGNI, the algorithm is fundamentally flawed, not situational. (b) Keep with lower priority — rejected: false positives are worse than unmatched emails.
**Rationale**: Rank-match pairs by commit-count rank order with zero semantic relationship. For ADO repos where `displayName` ("Leandro Fernandez") never matches email prefixes ("leandro@corp.com"), this incorrectly assigns externos' commits to wrong team members.

### Decision: Direct email matching only in ADO buildEmailMapEntries

**Choice**: Rewrite to use `this.contributorEmails` for direct `email → displayName` lookup. Remove existing name-match and prefix-match heuristics.
**Alternatives**: (a) Keep heuristics as fallback — rejected: ADO displayNames like "Leandro Fernandez" don't match email prefixes "leandro" anyway, so the heuristics are dead code for ADO. (b) ADO Identity API calls — deferred per proposal.
**Rationale**: With direct email data from commits API, heuristics are unnecessary. The generic name-group linking in `buildEmailMap` (step 3) already handles the case where an author uses multiple emails with the same git author name.

### Decision: Log unmatched emails at end of buildEmailMap

**Choice**: After all mapping steps complete, log emails from git log that remain unmapped.
**Alternatives**: (a) Return unmatched list — rejected: changes return type. (b) Only in snippet-extractor — already done there but happens later; logging at map-build time gives earlier diagnostics.
**Rationale**: Spec requires observability. Logging at map-build time is the natural place — it's where the mapping decision happens.

## Data Flow

```
repo-processor.ts
  │
  ├── provider.getContributors(ref)
  │       │
  │       └── ADO: paginates commits API
  │           ├─ Returns: Contributor[] (displayName as login)
  │           └─ Populates: this.contributorEmails { displayName → Set<email> }
  │
  ├── buildEmailMap(repoPath, contributors, provider)
  │       │
  │       ├── Step 1: provider.buildEmailMapEntries(contributors, repoPath)
  │       │       │
  │       │       └── ADO: reads this.contributorEmails → direct email→login map
  │       │           (no git log parse needed — data already from API)
  │       │
  │       ├── Step 2: git log parse (generic, unchanged)
  │       │
  │       └── Step 3: Name-group linking (generic, unchanged)
  │           emails with same author.name → same login if any matched
  │
  │       ┌── Step 4: REMOVED (was rank-match fallback) ──┐
  │       └───────────────────────────────────────────────┘
  │
  └── Step NEW: Log unmatched emails for observability
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/utils/git-blame.ts` | Modify | Remove rank-match block (lines 80-138). Add unmatched email logging after step 3. |
| `backend/src/providers/azure-devops.ts` | Modify | Add `private contributorEmails` map. Capture `author.email` in `getContributors`. Rewrite `buildEmailMapEntries` to use direct lookup from instance data instead of heuristics. |
| `backend/src/providers/types.ts` | No change | Interface preserved. |
| `packages/shared/src/types/repo.ts` | No change | `Contributor` type preserved. |
| `backend/src/providers/github.ts` | No change | Isolated per spec. |

## Interfaces / Contracts

**No interface changes.** The `GitProvider` interface and `Contributor` type remain identical.

**New internal data structure** (private to `AzureDevOpsProvider`):

```typescript
// Populated in getContributors, consumed in buildEmailMapEntries
private contributorEmails: Map<string, Set<string>> = new Map();
// key: displayName.toLowerCase(), value: Set of associated emails
```

**ADO commits API response** — already has `author.email`, currently discarded at line 131:

```typescript
// Already in the API response shape (line 118-119):
author?: {
  name?: string;    // ← currently used (as displayName/login)
  email?: string;   // ← currently DISCARDED — will be captured
  imageUrl?: string;
};
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `getContributors` captures emails in `contributorEmails` | Mock ADO commits API response with multiple authors and emails. Assert instance map populated correctly. |
| Unit | `buildEmailMapEntries` uses direct email lookup | Set `contributorEmails` on instance, call `buildEmailMapEntries`, assert correct mappings without git log dependency. |
| Unit | `buildEmailMap` no longer rank-matches | Construct contributors + git log scenario where old code would rank-match. Assert those emails remain unmapped. |
| Unit | `buildEmailMap` still does name-group linking | Same-author-name emails where one is matched — assert the other gets linked. |
| Unit | Unmatched emails are logged | Spy on console.log, verify `[blame-map]` unmatched email lines. |
| Integration | GitHub provider unaffected | Run existing GitHub email map logic unchanged. |

## Migration / Rollout

No migration required. The change is purely algorithmic — no data schema changes, no config changes, no feature flags. Rollback = revert the two modified files.

## Open Questions

- [ ] None — all decisions resolved by exploration and proposal.
