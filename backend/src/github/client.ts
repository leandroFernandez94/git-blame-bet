import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Contributor, RepoInfo } from "@git-blame-bet/shared";

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

/**
 * @deprecated Use `GitHubProvider.parseUrl()` from `providers/github.ts` instead.
 */
export function parseRepoUrl(url: string): { owner: string; repo: string } {
  const match = url.match(
    /github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?(?:\/.*)?$/,
  );
  if (!match) throw new Error("Invalid GitHub repository URL");
  return { owner: match[1], repo: match[2] };
}

/**
 * @deprecated Use `GitHubProvider.validateRepo()` from `providers/github.ts` instead.
 */
export async function validateRepo(
  owner: string,
  repo: string,
): Promise<RepoInfo> {
  const data = await ghFetch<{
    full_name: string;
    html_url: string;
    description: string | null;
    default_branch: string;
    stargazers_count: number;
    private: boolean;
  }>(`/repos/${owner}/${repo}`);

  if (data.private) throw new Error("Only public repositories are supported");

  return {
    owner,
    name: repo,
    fullName: data.full_name,
    url: data.html_url,
    description: data.description,
    defaultBranch: data.default_branch,
    stars: data.stargazers_count,
    contributorsCount: 0,
  };
}

/**
 * @deprecated Use `GitHubProvider.getContributors()` from `providers/github.ts` instead.
 */
export async function getContributors(
  owner: string,
  repo: string,
): Promise<Contributor[]> {
  const data = await ghFetch<
    { login: string; avatar_url: string; contributions: number }[]
  >(`/repos/${owner}/${repo}/contributors?per_page=100`);

  return data.map((c) => ({
    login: c.login,
    avatarUrl: c.avatar_url,
    commitsCount: c.contributions,
  }));
}

/**
 * @deprecated Unused in game flow. No replacement planned.
 */
export async function getRepoTree(
  owner: string,
  repo: string,
  branch: string,
): Promise<{ path: string; type: string }[]> {
  const data = await ghFetch<{
    tree: { path: string; type: string; size?: number }[];
  }>(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);

  return data.tree
    .filter((item) => item.type === "blob")
    .map((item) => ({ path: item.path, type: item.type }));
}

const CLONE_TIMEOUT_MS = 120_000;

export async function cloneRepo(repoUrl: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "gbb-"));
  const start = performance.now();
  console.log(`[clone] Starting full clone of ${repoUrl} into ${dir}`);

  const proc = Bun.spawn(
    ["git", "clone", "--single-branch", repoUrl, dir],
    { stdout: "ignore", stderr: "pipe" },
  );

  const timer = setTimeout(() => proc.kill(), CLONE_TIMEOUT_MS);

  const exitCode = await proc.exited;
  clearTimeout(timer);

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    console.log(`[clone] FAILED (exit ${exitCode}) after ${((performance.now() - start) / 1000).toFixed(1)}s: ${stderr.slice(0, 200)}`);
    throw new Error(
      exitCode === null || exitCode === 137
        ? "Repository clone timed out (2 min limit). Try a smaller repo."
        : `Git clone failed: ${stderr.slice(0, 200)}`,
    );
  }

  console.log(`[clone] Done in ${((performance.now() - start) / 1000).toFixed(1)}s -> ${dir}`);
  return dir;
}
