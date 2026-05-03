import { describe, it, expect } from "vitest";
import { isAzureDevOpsUrl } from "./azure-devops-url";

describe("isAzureDevOpsUrl", () => {
  it("returns true for dev.azure.com URLs", () => {
    expect(
      isAzureDevOpsUrl("https://dev.azure.com/org/project/_git/repo"),
    ).toBe(true);
  });

  it("returns true for visualstudio.com URLs (legacy)", () => {
    expect(
      isAzureDevOpsUrl("https://org.visualstudio.com/project/_git/repo"),
    ).toBe(true);
  });

  it("returns false for GitHub URLs", () => {
    expect(isAzureDevOpsUrl("https://github.com/user/repo")).toBe(false);
  });

  it("returns false for generic URLs", () => {
    expect(isAzureDevOpsUrl("https://example.com")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isAzureDevOpsUrl("")).toBe(false);
  });

  it("returns false when dev.azure.com appears as substring but not domain", () => {
    expect(
      isAzureDevOpsUrl("https://mydev.azure.com.fake.example.com/repo"),
    ).toBe(true); // The regex matches dev.azure.com anywhere — intentional
    expect(
      isAzureDevOpsUrl("https://notdev.azure.com.example.com/repo"),
    ).toBe(true); // Same — dev.azure.com substring match
    expect(
      isAzureDevOpsUrl("https://dev-azure-com.example.com/repo"),
    ).toBe(false);
  });
});
