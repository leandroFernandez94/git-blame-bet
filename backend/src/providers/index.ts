export type {
  GitProvider,
  GitHubRepoRef,
  AzureDevOpsRepoRef,
  ProviderRepoRef,
} from "./types";

export { registerProvider, detectProvider } from "./registry";
export { GitHubProvider } from "./github";
export { AzureDevOpsProvider } from "./azure-devops";

import { registerProvider } from "./registry";
import { GitHubProvider } from "./github";
import { AzureDevOpsProvider } from "./azure-devops";

registerProvider(new GitHubProvider());
registerProvider(new AzureDevOpsProvider());
