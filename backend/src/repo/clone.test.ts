import { describe, it, expect } from "vitest";
import { sanitizeCloneUrl } from "./clone";

describe("sanitizeCloneUrl", () => {
  it("replaces embedded PAT in ADO clone URL", () => {
    const url = "https://pat123@dev.azure.com/org/proj/_git/repo";
    expect(sanitizeCloneUrl(url)).toBe(
      "https://***@dev.azure.com/org/proj/_git/repo",
    );
  });

  it("leaves URL unchanged when no PAT is embedded", () => {
    const url = "https://dev.azure.com/org/proj/_git/repo";
    expect(sanitizeCloneUrl(url)).toBe(url);
  });

  it("leaves GitHub URLs unchanged", () => {
    const url = "https://github.com/user/repo.git";
    expect(sanitizeCloneUrl(url)).toBe(url);
  });

  it("handles PATs with special characters (= and !)", () => {
    const url = "https://pat=123!xyz@dev.azure.com/org/proj/_git/repo";
    expect(sanitizeCloneUrl(url)).toBe(
      "https://***@dev.azure.com/org/proj/_git/repo",
    );
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeCloneUrl("")).toBe("");
  });

  it("replaces PAT in error messages containing the URL", () => {
    const msg =
      'fatal: repository "https://secret-token@dev.azure.com/org/proj/_git/repo" not found';
    expect(sanitizeCloneUrl(msg)).toBe(
      'fatal: repository "https://***@dev.azure.com/org/proj/_git/repo" not found',
    );
  });
});
