import type { GitProvider, ProviderRepoRef } from "./types";

type GitProviderInstance = GitProvider<ProviderRepoRef>;

const providers: GitProviderInstance[] = [];

export function registerProvider(provider: GitProviderInstance): void {
  providers.push(provider);
}

export function detectProvider(url: string): GitProviderInstance {
  const provider = providers.find((p) => p.canHandle(url));
  if (!provider) {
    throw new Error(
      "Unsupported repository URL. Supported providers: GitHub, Azure DevOps.",
    );
  }
  return provider;
}
