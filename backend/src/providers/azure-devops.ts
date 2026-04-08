import type { Contributor, RepoInfo } from "@git-blame-bet/shared";
import type { EmailMap } from "../utils/git-blame";
import type { GitProvider, AzureDevOpsRepoRef } from "./types";

const ADO_COMMIT_PAGINATION_CAP = parseInt(
  process.env.ADO_COMMIT_PAGINATION_CAP ?? "1000",
  10,
);

function getPat(): string | null {
  return process.env.AZURE_DEVOPS_TOKEN ?? null;
}

function adoHeaders(): Record<string, string> {
  const pat = getPat();
  if (!pat) {
    throw new Error(
      "Azure DevOps authentication required. Set AZURE_DEVOPS_TOKEN env var.",
    );
  }
  return {
    Authorization: `Basic ${btoa(":" + pat)}`,
    "Content-Type": "application/json",
  };
}

async function adoFetch<T>(url: string): Promise<T> {
  const headers = adoHeaders();
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Azure DevOps API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export class AzureDevOpsProvider
  implements GitProvider<AzureDevOpsRepoRef>
{
  readonly name = "Azure DevOps";
  private contributorEmails: Map<string, Set<string>> = new Map();

  canHandle(url: string): boolean {
    return /dev\.azure\.com/.test(url) || /\.visualstudio\.com/.test(url);
  }

  parseUrl(url: string): AzureDevOpsRepoRef {
    // Pattern 1: https://dev.azure.com/{org}/{project}/_git/{repo}
    const match1 = url.match(
      /dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/?#]+)/,
    );
    if (match1) {
      return {
        provider: "azure-devops",
        org: match1[1],
        project: match1[2],
        repo: match1[3],
      };
    }

    // Pattern 2: https://{org}.visualstudio.com/{project}/_git/{repo} (legacy)
    const match2 = url.match(
      /([^/.]+)\.visualstudio\.com\/([^/]+)\/_git\/([^/?#]+)/,
    );
    if (match2) {
      return {
        provider: "azure-devops",
        org: match2[1],
        project: match2[2],
        repo: match2[3],
      };
    }

    throw new Error("Invalid Azure DevOps repository URL");
  }

  async validateRepo(ref: AzureDevOpsRepoRef): Promise<RepoInfo> {
    const url = `https://dev.azure.com/${ref.org}/${ref.project}/_apis/git/repositories/${ref.repo}?api-version=7.1`;
    const data = await adoFetch<{
      name: string;
      webUrl: string;
      defaultBranch: string;
      project?: { name: string };
    }>(url);

    return {
      owner: ref.org,
      name: ref.repo,
      fullName: `${ref.org}/${ref.project}/${ref.repo}`,
      url: data.webUrl,
      description: null,
      defaultBranch: data.defaultBranch ?? "main",
      stars: 0,
      contributorsCount: 0,
    };
  }

  async getContributors(ref: AzureDevOpsRepoRef): Promise<Contributor[]> {
    this.contributorEmails.clear();
    const authorMap = new Map<
      string,
      { displayName: string; avatarUrl: string; count: number }
    >();

    let skip = 0;
    const top = 100;
    let totalFetched = 0;

    while (totalFetched < ADO_COMMIT_PAGINATION_CAP) {
      const remaining = ADO_COMMIT_PAGINATION_CAP - totalFetched;
      const batchSize = Math.min(top, remaining);

      const url = `https://dev.azure.com/${ref.org}/${ref.project}/_apis/git/repositories/${ref.repo}/commits?api-version=7.1&$top=${batchSize}&$skip=${skip}&includeUserImageUrl=true`;

      const data = await adoFetch<{
        value: {
          author?: {
            name?: string;
            email?: string;
            imageUrl?: string;
          };
        }[];
        count: number;
      }>(url);

      const commits = data.value;
      if (!commits || commits.length === 0) break;

      for (const commit of commits) {
        const author = commit.author;
        if (!author?.name) continue;

        const displayName = author.name;
        const key = displayName.toLowerCase();
        const existing = authorMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          authorMap.set(key, {
            displayName,
            avatarUrl: author.imageUrl ?? "",
            count: 1,
          });
        }

        if (author.email) {
          const key = displayName.toLowerCase();
          const emailLower = author.email.toLowerCase();
          if (!this.contributorEmails.has(key)) {
            this.contributorEmails.set(key, new Set());
          }
          this.contributorEmails.get(key)!.add(emailLower);
        }
      }

      totalFetched += commits.length;
      skip += commits.length;

      if (commits.length < batchSize) break;
    }

    if (totalFetched >= ADO_COMMIT_PAGINATION_CAP) {
      console.log(
        `[ado-provider] Pagination cap reached at ${totalFetched} commits`,
      );
    }

    return [...authorMap.values()]
      .sort((a, b) => b.count - a.count)
      .map((a) => ({
        login: a.displayName,
        avatarUrl: a.avatarUrl,
        commitsCount: a.count,
      }));
  }

  getCloneUrl(ref: AzureDevOpsRepoRef): string {
    const pat = getPat();
    if (pat) {
      return `https://${pat}@dev.azure.com/${ref.org}/${ref.project}/_git/${ref.repo}`;
    }
    return `https://dev.azure.com/${ref.org}/${ref.project}/_git/${ref.repo}`;
  }

  getAvatarUrl(login: string): string {
    // ADO avatars come from the API response directly;
    // fallback is a generic placeholder
    return `https://dev.azure.com/_apis/graph/profiles/avatar/${encodeURIComponent(login)}`;
  }

  async buildEmailMapEntries(
    contributors: Contributor[],
    _repoPath: string,
  ): Promise<EmailMap> {
    const map: EmailMap = new Map();

    for (const contributor of contributors) {
      const emails = this.contributorEmails.get(
        contributor.login.toLowerCase(),
      );
      if (!emails) continue;
      for (const email of emails) {
        map.set(email, contributor.login);
      }
    }

    return map;
  }
}
