# Delta for ADO Contributor Enrichment

## MODIFIED Requirements

### Requirement: Email Capture in getContributors

`AzureDevOpsProvider.getContributors` MUST collect `author.email` from each commit's API response alongside `displayName` and store the email-to-login associations internally for use by `buildEmailMapEntries`. The `authorMap` MUST use lowercased `displayName` as its key so that the same author appearing with different casings (e.g., "Jane Doe" vs "jane doe") SHALL be merged into a single contributor entry. The pagination cap MUST allow processing up to 1000 commits to capture contributors beyond the initial 200. The `Contributor` return type SHALL NOT change.
(Previously: getContributors stored emails but used case-sensitive authorMap keys and was capped at 200 commits.)

#### Scenario: Single email per author captured

- GIVEN ADO commits API returns 30 commits where author "Jane Doe" has email "jane@corp.com" in every commit
- WHEN getContributors processes these commits
- THEN "jane@corp.com" is internally associated with displayName "Jane Doe"

#### Scenario: Multiple emails per author captured

- GIVEN ADO commits API returns commits where author displayName "Jane Doe" appears with both "jane@corp.com" (20 commits) and "jane.personal@gmail.com" (5 commits)
- WHEN getContributors processes these commits
- THEN both emails are internally associated with displayName "Jane Doe"

#### Scenario: Commit without email is skipped

- GIVEN ADO commits API returns a commit where `author.email` is null or missing
- WHEN getContributors processes this commit
- THEN the commit is counted for contributor totals but no email association is created for it

#### Scenario: Author with multiple emails

- GIVEN an author with displayName "Jane Doe" appears with both "jane@corp.com" and "jane.doe@gmail.com" across commits
- WHEN getContributors processes all commits
- THEN both emails are associated with contributor login "Jane Doe"

#### Scenario: Same author with different casing merged

- GIVEN ADO commits API returns commits where the same person appears as "Jane Doe" (15 commits) and "jane doe" (5 commits)
- WHEN getContributors processes these commits
- THEN both casings are merged into a single contributor entry with login "Jane Doe" (first-seen casing preserved)
- AND the commit count is 20

#### Scenario: Contributors beyond 200 commits captured

- GIVEN ADO commits API returns 350 commits and author "New Contributor" only appears after commit 200
- WHEN getContributors processes commits up to the pagination cap
- THEN "New Contributor" is included in the contributor list

### Requirement: Direct Email Matching in buildEmailMapEntries

`AzureDevOpsProvider.buildEmailMapEntries` MUST iterate the `_contributors` array parameter, not internal Map keys. For each contributor, it SHALL perform a lowercased lookup into the internal email store (`contributorEmails.get(contributor.login.toLowerCase())`) and map entries MUST use `contributor.login` (original case from the contributors array) as the email map value. It SHALL NOT rely on heuristics like email-prefix or display-name substring matching.
(Previously: buildEmailMapEntries iterated contributorEmails Map keys directly, which were lowercased, causing lowercased logins in the email map.)

#### Scenario: Direct email-to-login mapping with original case

- GIVEN getContributors returned contributor with login "Leandro Fernandez" and captured email "user@company.com"
- WHEN buildEmailMapEntries processes git log containing "user@company.com"
- THEN the email is directly mapped to login "Leandro Fernandez" (original case preserved)

#### Scenario: All emails unmatched

- GIVEN all git log emails belong to externos who left and match no current contributor's email data
- WHEN buildEmailMapEntries runs
- THEN no mappings are created from ADO enrichment
- AND unmatched emails are logged for observability

#### Scenario: Login casing preserved in email map

- GIVEN getContributors returned contributor with login "Jane Doe" (mixed case) and the internal email store keys are lowercased
- WHEN buildEmailMapEntries iterates contributors and looks up "jane doe" in the email store
- THEN the email map entry value is "Jane Doe" (original case from contributor login)

## ADDED Requirements

(None — all changes are modifications to existing requirements.)
