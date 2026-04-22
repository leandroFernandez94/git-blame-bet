import { describe, it, expect, vi, beforeEach } from "vitest";
import { AzureDevOpsProvider } from "./azure-devops";
import type { AzureDevOpsRepoRef } from "./types";

describe("AzureDevOpsProvider", () => {
  let provider: AzureDevOpsProvider;
  const sampleRef: AzureDevOpsRepoRef = {
    provider: "azure-devops",
    org: "contoso",
    project: "web",
    repo: "api",
  };

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe("getPat (via getCloneUrl)", () => {
    it("returns user token when provided to constructor", () => {
      provider = new AzureDevOpsProvider("user-token-123");
      const url = provider.getCloneUrl(sampleRef);
      expect(url).toContain("user-token-123@");
    });

    it("falls back to AZURE_DEVOPS_TOKEN env var when no user token", () => {
      vi.stubEnv("AZURE_DEVOPS_TOKEN", "env-token-456");
      provider = new AzureDevOpsProvider();
      const url = provider.getCloneUrl(sampleRef);
      expect(url).toContain("env-token-456@");
    });

    it("returns clone URL without token when neither user token nor env var", () => {
      provider = new AzureDevOpsProvider();
      const url = provider.getCloneUrl(sampleRef);
      expect(url).not.toMatch(/https:\/\/[^*]+@/);
      expect(url).toBe(
        "https://dev.azure.com/contoso/web/_git/api",
      );
    });

    it("user token overrides env var when both are present", () => {
      vi.stubEnv("AZURE_DEVOPS_TOKEN", "env-token-456");
      provider = new AzureDevOpsProvider("user-token-123");
      const url = provider.getCloneUrl(sampleRef);
      expect(url).toContain("user-token-123@");
      expect(url).not.toContain("env-token-456");
    });
  });

  describe("getCloneUrl", () => {
    it("embeds token in URL when PAT is available", () => {
      provider = new AzureDevOpsProvider("my-secret-pat");
      const url = provider.getCloneUrl(sampleRef);
      expect(url).toBe(
        "https://my-secret-pat@dev.azure.com/contoso/web/_git/api",
      );
    });

    it("returns plain URL when no PAT is available", () => {
      provider = new AzureDevOpsProvider();
      const url = provider.getCloneUrl(sampleRef);
      expect(url).toBe(
        "https://dev.azure.com/contoso/web/_git/api",
      );
    });
  });

  describe("canHandle", () => {
    it("returns true for dev.azure.com URLs", () => {
      provider = new AzureDevOpsProvider();
      expect(
        provider.canHandle("https://dev.azure.com/org/proj/_git/repo"),
      ).toBe(true);
    });

    it("returns true for visualstudio.com URLs", () => {
      provider = new AzureDevOpsProvider();
      expect(
        provider.canHandle("https://org.visualstudio.com/proj/_git/repo"),
      ).toBe(true);
    });

    it("returns false for GitHub URLs", () => {
      provider = new AzureDevOpsProvider();
      expect(provider.canHandle("https://github.com/user/repo")).toBe(false);
    });
  });

  describe("name", () => {
    it("has correct provider name", () => {
      provider = new AzureDevOpsProvider();
      expect(provider.name).toBe("Azure DevOps");
    });
  });
});
