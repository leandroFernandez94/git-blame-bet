import type { Contributor, RepoInfo } from "@git-blame-bet/shared";
import type { EmailMap } from "../utils/git-blame";

// --- Provider-specific identity types ---

export type GitHubRepoRef = {
  provider: "github";
  owner: string;
  repo: string;
};

export type AzureDevOpsRepoRef = {
  provider: "azure-devops";
  org: string;
  project: string;
  repo: string;
};

export type ProviderRepoRef = GitHubRepoRef | AzureDevOpsRepoRef;

// --- Provider interface ---

export interface GitProvider<TRef extends ProviderRepoRef = ProviderRepoRef> {
  /** Human-readable provider name for error messages */
  readonly name: string;

  /** Check if this provider handles the given URL */
  canHandle(url: string): boolean;

  /** Parse URL into provider-specific identity */
  parseUrl(url: string): TRef;

  /** Validate repo exists and is accessible. Returns metadata. */
  validateRepo(ref: TRef): Promise<RepoInfo>;

  /** Fetch contributors for the repository */
  getContributors(ref: TRef): Promise<Contributor[]>;

  /** Get a clone-ready URL (may embed auth for private providers) */
  getCloneUrl(ref: TRef): string;

  /** Resolve avatar URL for a contributor login */
  getAvatarUrl(login: string): string;

  /**
   * Build provider-specific email→login mappings from git log.
   * Returns entries to MERGE into the email map (does not replace generic entries).
   */
  buildEmailMapEntries(
    contributors: Contributor[],
    repoPath: string,
  ): Promise<EmailMap>;
}
