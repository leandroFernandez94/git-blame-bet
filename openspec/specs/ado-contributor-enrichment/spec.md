# ADO Contributor Enrichment Specification

## Purpose

Defines how the Azure DevOps provider enriches contributor data with email information from the commits API, enabling direct email-to-login mapping without heuristics.

## Requirements

### Requirement: Email Capture in getContributors

`AzureDevOpsProvider.getContributors` MUST collect `author.email` from each commit's API response alongside `displayName` and store the email-to-login associations internally for use by `buildEmailMapEntries`. The `Contributor` return type SHALL NOT change.

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

### Requirement: Direct Email Matching in buildEmailMapEntries

`AzureDevOpsProvider.buildEmailMapEntries` MUST use the email-to-login associations captured by `getContributors` to directly map git log emails to contributor logins. It SHALL NOT rely on heuristics like email-prefix or display-name substring matching.

#### Scenario: Direct email-to-login mapping

- GIVEN getContributors captured email "user@company.com" for displayName "Leandro Fernandez"
- WHEN buildEmailMapEntries processes git log containing "user@company.com"
- THEN the email is directly mapped to login "Leandro Fernandez"

#### Scenario: All emails unmatched

- GIVEN all git log emails belong to externos who left and match no current contributor's email data
- WHEN buildEmailMapEntries runs
- THEN no mappings are created from ADO enrichment
- AND unmatched emails are logged for observability

### Requirement: GitHub Provider Isolation

The GitHub provider's `getContributors` and `buildEmailMapEntries` methods MUST NOT be modified by this change.

#### Scenario: GitHub provider unaffected

- GIVEN a GitHub repo processed through buildEmailMap
- WHEN the GitHub provider's buildEmailMapEntries runs
- THEN it behaves identically to before this change (noreply patterns, prefix matching, name matching all intact)
