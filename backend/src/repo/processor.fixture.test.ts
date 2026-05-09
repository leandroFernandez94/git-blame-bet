import { describe, expect, it, vi } from "vitest";
import type { Contributor } from "@git-blame-bet/shared";

const createProviderMock = vi.fn();
const cloneRepoMock = vi.fn();
const getCacheKeyMock = vi.fn();
const isCachedMock = vi.fn();
const extractSnippetsMock = vi.fn();
const buildEmailMapMock = vi.fn();
const scheduleTempCleanupMock = vi.fn();

vi.mock("../providers", () => ({
  createProvider: createProviderMock,
}));

vi.mock("./clone", () => ({
  cloneRepo: cloneRepoMock,
}));

vi.mock("./repo-cache", () => ({
  getCacheKey: getCacheKeyMock,
  isCached: isCachedMock,
}));

vi.mock("./snippet-extractor", () => ({
  extractSnippets: extractSnippetsMock,
}));

vi.mock("../utils/git-blame", () => ({
  buildEmailMap: buildEmailMapMock,
}));

vi.mock("../utils/cleanup", () => ({
  scheduleTempCleanup: scheduleTempCleanupMock,
}));

describe("processRepo fixture consumption", () => {
  it("returns deterministic fixture rounds when fixtureId is standard-repo", async () => {
    const { processRepo } = await import("./processor");

    const result = await processRepo(
      "https://github.com/example/standard-repo",
      undefined,
      undefined,
      undefined,
      "standard-repo",
    );

    expect(result.repoPath).toBe("fixture://standard-repo");
    expect(result.rounds).toHaveLength(5);
    expect(result.rounds[0]?.correctLogin).toBe("alice-dev");
    expect(result.rounds[1]?.correctLogin).toBe("bob-dev");

    const contributorNames = result.contributors.map(
      (contributor: Contributor) => contributor.displayName,
    );
    expect(contributorNames).toEqual(["alice-dev", "bob-dev", "carol-dev"]);

    expect(cloneRepoMock).not.toHaveBeenCalled();
    expect(extractSnippetsMock).not.toHaveBeenCalled();
    expect(buildEmailMapMock).not.toHaveBeenCalled();
    expect(createProviderMock).not.toHaveBeenCalled();
  });

  it("keeps provider pipeline for non-fixture runs", async () => {
    const { processRepo } = await import("./processor");

    const provider = {
      name: "TestProvider",
      parseUrl: vi.fn(() => ({ provider: "github", owner: "org", repo: "repo" })),
      validateRepo: vi.fn(async () => undefined),
      getContributors: vi.fn(async () => [
        { displayName: "alice-dev", avatarUrl: "", commitsCount: 3 },
        { displayName: "bob-dev", avatarUrl: "", commitsCount: 2 },
        { displayName: "carol-dev", avatarUrl: "", commitsCount: 1 },
      ]),
      getCloneUrl: vi.fn(() => "https://github.com/org/repo.git"),
      getAvatarUrl: vi.fn((login: string) => `https://example.com/${login}.png`),
      buildEmailMapEntries: vi.fn(async () => new Map()),
    };

    getCacheKeyMock.mockReturnValue("repo-key");
    cloneRepoMock.mockResolvedValue("/tmp/repo");
    buildEmailMapMock.mockResolvedValue(new Map());
    extractSnippetsMock.mockResolvedValue([
      {
        code: "const value = 1;",
        language: "typescript",
        filePath: "src/a.ts",
        startLine: 1,
        blame: { displayName: "alice-dev" },
      },
      {
        code: "const value = 2;",
        language: "typescript",
        filePath: "src/b.ts",
        startLine: 1,
        blame: { displayName: "bob-dev" },
      },
      {
        code: "const value = 3;",
        language: "typescript",
        filePath: "src/c.ts",
        startLine: 1,
        blame: { displayName: "carol-dev" },
      },
      {
        code: "const value = 4;",
        language: "typescript",
        filePath: "src/d.ts",
        startLine: 1,
        blame: { displayName: "alice-dev" },
      },
      {
        code: "const value = 5;",
        language: "typescript",
        filePath: "src/e.ts",
        startLine: 1,
        blame: { displayName: "bob-dev" },
      },
    ]);
    isCachedMock.mockReturnValue(true);

    const result = await processRepo(
      "https://github.com/org/repo",
      undefined,
      undefined,
      provider as never,
    );

    expect(provider.validateRepo).toHaveBeenCalled();
    expect(provider.getContributors).toHaveBeenCalled();
    expect(cloneRepoMock).toHaveBeenCalled();
    expect(extractSnippetsMock).toHaveBeenCalled();
    expect(result.rounds.length).toBe(5);
    expect(result.repoPath).toBe("/tmp/repo");
  });
});
