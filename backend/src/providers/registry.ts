import { isAzureDevOpsUrl } from "@git-blame-bet/shared";
import type { GitProvider, ProviderRepoRef } from "./types";
import { GitHubProvider } from "./github";
import { AzureDevOpsProvider } from "./azure-devops";

type GitProviderInstance = GitProvider<ProviderRepoRef>;

const providers: GitProviderInstance[] = [];

export function registerProvider(provider: GitProviderInstance): void {
  providers.push(provider);
}

export function detectProvider(url: string): GitProviderInstance {
  const provider = providers.find((p) => p.canHandle(url));
  if (provider) return provider;

  return createProvider(url);
}

export function createProvider(
  repoUrl: string,
  azureDevOpsToken?: string,
): GitProviderInstance {
  if (isAzureDevOpsUrl(repoUrl)) {
    return new AzureDevOpsProvider(azureDevOpsToken);
  }
  return new GitHubProvider();
}
