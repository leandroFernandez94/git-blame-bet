import { describe, it, expect, vi } from "vitest";

// GitHub provider imports `bun` which isn't available in vitest/node.
// Mock it before importing registry.
vi.mock("./github", () => {
  class MockGitHubProvider {
    readonly name = "GitHub";
    canHandle(url: string) {
      return /github\.com[/:]/.test(url);
    }
    parseUrl() {
      return { provider: "github" as const, owner: "user", repo: "repo" };
    }
  }
  return { GitHubProvider: MockGitHubProvider };
});

import { createProvider } from "./registry";
import { AzureDevOpsProvider } from "./azure-devops";

describe("createProvider", () => {
  it("creates AzureDevOpsProvider without token for ADO URL", () => {
    const provider = createProvider(
      "https://dev.azure.com/org/proj/_git/repo",
    );
    expect(provider).toBeInstanceOf(AzureDevOpsProvider);
    // No token → getCloneUrl should not embed credentials
    const ref = provider.parseUrl(
      "https://dev.azure.com/org/proj/_git/repo",
    );
    const url = provider.getCloneUrl(ref);
    expect(url).not.toMatch(/https:\/\/[^*]+@/);
  });

  it("creates AzureDevOpsProvider with token for ADO URL", () => {
    const provider = createProvider(
      "https://dev.azure.com/org/proj/_git/repo",
      "my-token-abc",
    );
    expect(provider).toBeInstanceOf(AzureDevOpsProvider);
    const ref = provider.parseUrl(
      "https://dev.azure.com/org/proj/_git/repo",
    );
    const url = provider.getCloneUrl(ref);
    expect(url).toContain("my-token-abc@");
  });

  it("creates GitHubProvider for GitHub URL", () => {
    const provider = createProvider("https://github.com/user/repo");
    expect(provider.name).toBe("GitHub");
  });

  it("creates GitHubProvider as fallback for unknown URL", () => {
    const provider = createProvider("https://gitlab.com/user/repo.git");
    expect(provider.name).toBe("GitHub");
  });
});
