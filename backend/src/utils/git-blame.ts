import { $ } from "bun";
import type { Contributor } from "@git-blame-bet/shared";
import type { GitProvider } from "../providers/types";

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
  provider: GitProvider,
): Promise<EmailMap> {
  const map: EmailMap = new Map();
  const start = performance.now();

  try {
    // 1. Provider-specific email→login mappings (e.g., GitHub noreply patterns)
    const providerEntries = await provider.buildEmailMapEntries(
      contributors,
      repoPath,
    );
    for (const [email, login] of providerEntries) {
      map.set(email, login);
    }

    // 2. Parse git log for generic name-group linking and rank-based fallback
    const result =
      await $`git -C ${repoPath} log --format=%ae%n%an --all`.quiet();
    const lines = result.stdout.toString().trim().split("\n");

    const emailNamePairs: { email: string; name: string }[] = [];
    for (let i = 0; i < lines.length - 1; i += 2) {
      emailNamePairs.push({
        email: lines[i].trim().toLowerCase(),
        name: lines[i + 1].trim(),
      });
    }

    const emailCommitCounts = new Map<string, number>();
    for (const { email } of emailNamePairs) {
      emailCommitCounts.set(
        email,
        (emailCommitCounts.get(email) ?? 0) + 1,
      );
    }

    // 3. Generic name-group linking — emails with the same author name
    //    get mapped to the same login if any one of them is known
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
          console.log(
            `[blame-map] Linked "${email}" -> ${knownLogin} (same author name "${nameLower}")`,
          );
        }
      }
    }

    // 4. Rank-based unmatched fallback — match unmatched contributors
    //    to unmatched email groups by commit count rank
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

      const nameGroupCounts = new Map<
        string,
        { count: number; emails: string[] }
      >();
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

      const rankedUnmatchedAuthors = [...nameGroupCounts.entries()].sort(
        (a, b) => b[1].count - a[1].count,
      );

      const matchCount = Math.min(
        unmatchedContributors.length,
        rankedUnmatchedAuthors.length,
      );
      for (let i = 0; i < matchCount; i++) {
        const contributor = unmatchedContributors[i];
        const [authorName, { emails, count }] = rankedUnmatchedAuthors[i];

        if (count < 5) break;

        for (const email of emails) {
          map.set(email, contributor.login);
        }
        console.log(
          `[blame-map] Rank-matched "${authorName}" (${count} commits, ${emails.length} emails) -> ${contributor.login} (${contributor.commitsCount} API commits)`,
        );
      }
    }
  } catch (e) {
    console.log(
      `[blame-map] git log failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  console.log(
    `[blame-map] Built email map: ${map.size} entries in ${((performance.now() - start) / 1000).toFixed(1)}s`,
  );
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
    console.log(
      `[blame] ERROR on ${filePath}:${startLine}-${endLine}: ${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  }
}

function matchContributorLogin(
  authorName: string,
  authorEmail: string,
  contributors: Contributor[],
  emailMap?: EmailMap,
): string | null {
  // 1. Check emailMap first (contains provider-specific entries)
  if (emailMap) {
    const mapped = emailMap.get(authorEmail.toLowerCase());
    if (mapped) return mapped;
  }

  // 2. Generic name matching fallback
  const nameMatch = contributors.find(
    (c) => c.login.toLowerCase() === authorName.toLowerCase(),
  );
  if (nameMatch) return nameMatch.login;

  // 3. Generic email prefix matching fallback
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

  const login = matchContributorLogin(
    authorName,
    authorEmail,
    contributors,
    emailMap,
  );

  return {
    login,
    authorName,
    authorEmail,
    commitSha,
  };
}
