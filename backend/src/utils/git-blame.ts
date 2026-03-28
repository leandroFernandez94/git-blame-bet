import { $ } from "bun";
import type { Contributor } from "@git-blame-bet/shared";

export type BlameResult = {
  login: string | null;
  authorName: string;
  authorEmail: string;
  commitSha: string;
};

export type EmailMap = Map<string, string>;

export async function buildEmailMap(
  repoPath: string,
  contributors: Contributor[],
): Promise<EmailMap> {
  const map: EmailMap = new Map();
  const start = performance.now();

  for (const c of contributors) {
    map.set(`${c.login}@users.noreply.github.com`.toLowerCase(), c.login);
  }

  try {
    const result = await $`git -C ${repoPath} log --format=%ae%n%an --all`.quiet();
    const lines = result.stdout.toString().trim().split("\n");

    const emailNamePairs: { email: string; name: string }[] = [];
    for (let i = 0; i < lines.length - 1; i += 2) {
      emailNamePairs.push({ email: lines[i].trim().toLowerCase(), name: lines[i + 1].trim() });
    }

    const emailCommitCounts = new Map<string, number>();
    for (const { email } of emailNamePairs) {
      emailCommitCounts.set(email, (emailCommitCounts.get(email) ?? 0) + 1);
    }

    for (const c of contributors) {
      const loginLower = c.login.toLowerCase();

      for (const { email, name } of emailNamePairs) {
        if (map.has(email)) continue;

        const noreplyMatch = email.match(/^\d+\+([^@]+)@users\.noreply\.github\.com$/);
        if (noreplyMatch && noreplyMatch[1].toLowerCase() === loginLower) {
          map.set(email, c.login);
          continue;
        }

        if (email.endsWith("@users.noreply.github.com")) {
          const prefix = email.split("@")[0].toLowerCase();
          if (prefix === loginLower || prefix.endsWith(`+${loginLower}`)) {
            map.set(email, c.login);
            continue;
          }
        }

        const prefix = email.split("@")[0].toLowerCase();
        if (prefix === loginLower) {
          map.set(email, c.login);
          continue;
        }

        if (name.toLowerCase() === loginLower) {
          map.set(email, c.login);
        }
      }
    }

    const nameToEmails = new Map<string, string[]>();
    for (const { email, name } of emailNamePairs) {
      const nameLower = name.toLowerCase();
      if (!nameToEmails.has(nameLower)) nameToEmails.set(nameLower, []);
      if (!nameToEmails.get(nameLower)!.includes(email)) {
        nameToEmails.get(nameLower)!.push(email);
      }
    }

    for (const [nameLower, emails] of nameToEmails) {
      const knownLogin = emails
        .map((e) => map.get(e))
        .find((l) => l !== undefined);
      if (!knownLogin) continue;

      for (const email of emails) {
        if (!map.has(email)) {
          map.set(email, knownLogin);
          console.log(`[blame-map] Linked "${email}" -> ${knownLogin} (same author name "${nameLower}")`);
        }
      }
    }

    const gitLogEmails = new Set(emailCommitCounts.keys());
    const reallyMatchedLogins = new Set<string>();
    for (const [email, login] of map) {
      if (gitLogEmails.has(email)) reallyMatchedLogins.add(login);
    }
    const unmatchedContributors = contributors
      .filter((c) => !reallyMatchedLogins.has(c.login))
      .sort((a, b) => b.commitsCount - a.commitsCount);

    if (unmatchedContributors.length > 0) {
      const unmatchedEmails = [...emailCommitCounts.entries()]
        .filter(([email]) => !map.has(email))
        .sort((a, b) => b[1] - a[1]);

      const emailToName = new Map<string, string>();
      for (const { email, name } of emailNamePairs) {
        if (!emailToName.has(email)) emailToName.set(email, name);
      }

      const nameGroupCounts = new Map<string, { count: number; emails: string[] }>();
      for (const [email, count] of unmatchedEmails) {
        const name = emailToName.get(email) ?? email;
        const nameLower = name.toLowerCase();
        const existing = nameGroupCounts.get(nameLower);
        if (existing) {
          existing.count += count;
          existing.emails.push(email);
        } else {
          nameGroupCounts.set(nameLower, { count, emails: [email] });
        }
      }

      const rankedUnmatchedAuthors = [...nameGroupCounts.entries()]
        .sort((a, b) => b[1].count - a[1].count);

      const matchCount = Math.min(unmatchedContributors.length, rankedUnmatchedAuthors.length);
      for (let i = 0; i < matchCount; i++) {
        const contributor = unmatchedContributors[i];
        const [authorName, { emails, count }] = rankedUnmatchedAuthors[i];

        if (count < 5) break;

        for (const email of emails) {
          map.set(email, contributor.login);
        }
        console.log(`[blame-map] Rank-matched "${authorName}" (${count} commits, ${emails.length} emails) -> ${contributor.login} (${contributor.commitsCount} API commits)`);
      }
    }
  } catch (e) {
    console.log(`[blame-map] git log failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  console.log(`[blame-map] Built email map: ${map.size} entries in ${((performance.now() - start) / 1000).toFixed(1)}s`);
  return map;
}

export async function getBlameForLines(
  repoPath: string,
  filePath: string,
  startLine: number,
  endLine: number,
  contributors: Contributor[],
  emailMap?: EmailMap,
): Promise<BlameResult | null> {
  try {
    const result =
      await $`git -C ${repoPath} blame -L ${startLine},${endLine} --porcelain -- ${filePath}`.quiet();
    const output = result.stdout.toString();
    return parseBlameOutput(output, contributors, emailMap);
  } catch (e) {
    console.log(`[blame] ERROR on ${filePath}:${startLine}-${endLine}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

function matchContributorLogin(
  authorName: string,
  authorEmail: string,
  contributors: Contributor[],
  emailMap?: EmailMap,
): string | null {
  if (emailMap) {
    const mapped = emailMap.get(authorEmail.toLowerCase());
    if (mapped) return mapped;
  }

  const noreplyMatch = authorEmail.match(
    /^\d+\+([^@]+)@users\.noreply\.github\.com$/,
  );
  if (noreplyMatch) {
    const login = noreplyMatch[1];
    const found = contributors.find(
      (c) => c.login.toLowerCase() === login.toLowerCase(),
    );
    if (found) return found.login;
  }

  const nameMatch = contributors.find(
    (c) => c.login.toLowerCase() === authorName.toLowerCase(),
  );
  if (nameMatch) return nameMatch.login;

  const emailPrefix = authorEmail.split("@")[0].toLowerCase();
  const prefixMatch = contributors.find(
    (c) => c.login.toLowerCase() === emailPrefix,
  );
  if (prefixMatch) return prefixMatch.login;

  return null;
}

function parseBlameOutput(
  output: string,
  contributors: Contributor[],
  emailMap?: EmailMap,
): BlameResult | null {
  const lines = output.split("\n");
  let commitSha = "";
  let authorName = "";
  let authorEmail = "";

  for (const line of lines) {
    if (/^[0-9a-f]{40}/.test(line) && !commitSha) {
      commitSha = line.split(" ")[0];
    }
    if (line.startsWith("author ")) {
      authorName = line.slice(7);
    }
    if (line.startsWith("author-mail ")) {
      authorEmail = line.slice(12).replace(/[<>]/g, "");
    }
  }

  if (!authorName || !commitSha) return null;

  const login = matchContributorLogin(authorName, authorEmail, contributors, emailMap);

  return {
    login,
    authorName,
    authorEmail,
    commitSha,
  };
}
