import { $ } from "bun";
import type { Contributor, RepoInfo } from "@git-blame-bet/shared";
import type { EmailMap } from "../utils/git-blame";
import type { GitProvider, GitHubRepoRef } from "./types";

const GITHUB_API = "https://api.github.com";

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "git-blame-bet",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function ghFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: headers() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export class GitHubProvider implements GitProvider<GitHubRepoRef> {
  readonly name = "GitHub";

  canHandle(url: string): boolean {
    return /github\.com[/:]/.test(url);
  }

  parseUrl(url: string): GitHubRepoRef {
    const match = url.match(
      /github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?(?:\/.*)?$/,
    );
    if (!match) throw new Error("Invalid GitHub repository URL");
    return { provider: "github", owner: match[1], repo: match[2] };
  }

  async validateRepo(ref: GitHubRepoRef): Promise<RepoInfo> {
    const data = await ghFetch<{
      full_name: string;
      html_url: string;
      description: string | null;
      default_branch: string;
      stargazers_count: number;
      private: boolean;
    }>(`/repos/${ref.owner}/${ref.repo}`);

    if (data.private) throw new Error("Only public repositories are supported");

    return {
      owner: ref.owner,
      name: ref.repo,
      fullName: data.full_name,
      url: data.html_url,
      description: data.description,
      defaultBranch: data.default_branch,
      stars: data.stargazers_count,
      contributorsCount: 0,
    };
  }

  async getContributors(ref: GitHubRepoRef): Promise<Contributor[]> {
    const data = await ghFetch<
      { login: string; avatar_url: string; contributions: number }[]
    >(`/repos/${ref.owner}/${ref.repo}/contributors?per_page=100`);

    return data.map((c) => ({
      login: c.login,
      avatarUrl: c.avatar_url,
      commitsCount: c.contributions,
    }));
  }

  getCloneUrl(ref: GitHubRepoRef): string {
    return `https://github.com/${ref.owner}/${ref.repo}.git`;
  }

  getAvatarUrl(login: string): string {
    return `https://github.com/${login}.png`;
  }

  async buildEmailMapEntries(
    contributors: Contributor[],
    repoPath: string,
  ): Promise<EmailMap> {
    const map: EmailMap = new Map();

    // Direct noreply mapping for each contributor
    for (const c of contributors) {
      map.set(`${c.login}@users.noreply.github.com`.toLowerCase(), c.login);
    }

    try {
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

      for (const c of contributors) {
        const loginLower = c.login.toLowerCase();

        for (const { email, name } of emailNamePairs) {
          if (map.has(email)) continue;

          // Noreply regex: 12345+user@users.noreply.github.com
          const noreplyMatch = email.match(
            /^\d+\+([^@]+)@users\.noreply\.github\.com$/,
          );
          if (noreplyMatch && noreplyMatch[1].toLowerCase() === loginLower) {
            map.set(email, c.login);
            continue;
          }

          // Noreply prefix matching
          if (email.endsWith("@users.noreply.github.com")) {
            const prefix = email.split("@")[0].toLowerCase();
            if (prefix === loginLower || prefix.endsWith(`+${loginLower}`)) {
              map.set(email, c.login);
              continue;
            }
          }

          // Email prefix matching
          const prefix = email.split("@")[0].toLowerCase();
          if (prefix === loginLower) {
            map.set(email, c.login);
            continue;
          }

          // Name matching
          if (name.toLowerCase() === loginLower) {
            map.set(email, c.login);
          }
        }
      }
    } catch (e) {
      console.log(
        `[github-provider] git log failed for email map: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    return map;
  }
}
