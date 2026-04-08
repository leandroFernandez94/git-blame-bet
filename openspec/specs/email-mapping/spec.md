# Email Mapping Specification

## Purpose

Defines the behavior of `buildEmailMap` in `git-blame.ts` — the algorithm that maps git commit author emails to contributor logins for blame attribution.

## Requirements

### Requirement: No Rank-Based Fallback

`buildEmailMap` MUST NOT pair unmatched emails with unmatched contributors by commit-count rank order. Unmatched emails SHALL remain unmapped (login = null).

#### Scenario: Unmatched emails are not force-paired

- GIVEN a repo with 5 contributors and 8 unique git log emails
- WHEN 3 emails cannot be matched by provider entries or name-group linking
- THEN those 3 emails remain unmatched and are NOT paired with unmatched contributors by rank

#### Scenario: No rank-match log lines produced

- GIVEN any ADO repo processed by buildEmailMap
- WHEN the function completes
- THEN no log line containing "Rank-matched" appears in output

### Requirement: Generic Name-Group Linking Preserved

Emails sharing the same git `author.name` MUST be mapped to the same login if any email in the group was already matched.

#### Scenario: Name-group links unmatched email to known login

- GIVEN git log has emails "john@work.com" and "john@personal.com" both with author.name "John Smith"
- AND "john@work.com" is mapped to login "jsmith" by provider entries
- WHEN buildEmailMap processes name groups
- THEN "john@personal.com" is also mapped to login "jsmith"

#### Scenario: No match in group leaves all unmatched

- GIVEN git log has two emails with author.name "Unknown" and neither is matched by provider entries
- WHEN buildEmailMap processes name groups
- THEN both emails remain unmatched

### Requirement: Unmatched Email Observability

Emails that cannot be matched to any contributor after all mapping steps MUST be logged with a `[blame-map]` prefix.

#### Scenario: Unmatched email logged

- GIVEN an email "externo@company.com" appears in git log but matches no contributor
- WHEN buildEmailMap completes
- THEN a log line with prefix `[blame-map]` indicates the email was unmatched
