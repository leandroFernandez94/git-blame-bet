import { describe, it, expect, beforeEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProviderRepoRef } from "../providers/types";

describe("repo-cache", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function getModule() {
    return import("./repo-cache");
  }

  describe("getCacheKey", () => {
    it("derives key for GitHub ref", async () => {
      const { getCacheKey } = await getModule();
      const ref: ProviderRepoRef = {
        provider: "github",
        owner: "facebook",
        repo: "react",
      };
      expect(getCacheKey(ref)).toBe("github:facebook/react");
    });

    it("derives key for Azure DevOps ref", async () => {
      const { getCacheKey } = await getModule();
      const ref: ProviderRepoRef = {
        provider: "azure-devops",
        org: "contoso",
        project: "web",
        repo: "api",
      };
      expect(getCacheKey(ref)).toBe("ado:contoso/web/api");
    });
  });

  describe("getOrClone", () => {
    it("invokes cloneFn on first call and returns cached path on second", async () => {
      const { getOrClone } = await getModule();
      const fakeDir = mkdtempSync(join(tmpdir(), "test-clone-"));
      mkdirSync(join(fakeDir, ".git"), { recursive: true });
      const cloneFn = vi.fn().mockResolvedValue(fakeDir);

      const result1 = await getOrClone("github:facebook/react", cloneFn);
      expect(result1).toBe(fakeDir);
      expect(cloneFn).toHaveBeenCalledTimes(1);

      const result2 = await getOrClone("github:facebook/react", cloneFn);
      expect(result2).toBe(fakeDir);
      expect(cloneFn).toHaveBeenCalledTimes(1);

      rmSync(fakeDir, { recursive: true, force: true });
    });

    it("deduplicates concurrent calls for the same key", async () => {
      const { getOrClone } = await getModule();
      const fakeDir = mkdtempSync(join(tmpdir(), "test-dedup-"));
      mkdirSync(join(fakeDir, ".git"), { recursive: true });

      let resolveClone: (dir: string) => void;
      const clonePromise = new Promise<string>((resolve) => {
        resolveClone = resolve;
      });
      const cloneFn = vi.fn().mockReturnValue(clonePromise);

      const p1 = getOrClone("github:test/dedup", cloneFn);
      const p2 = getOrClone("github:test/dedup", cloneFn);

      expect(cloneFn).toHaveBeenCalledTimes(1);

      resolveClone!(fakeDir);

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBe(fakeDir);
      expect(r2).toBe(fakeDir);

      rmSync(fakeDir, { recursive: true, force: true });
    });
  });

  describe("isCached", () => {
    it("returns false before clone", async () => {
      const { isCached } = await getModule();
      expect(isCached("github:uncached/repo")).toBe(false);
    });

    it("returns true after clone resolves", async () => {
      const { getOrClone, isCached } = await getModule();
      const fakeDir = mkdtempSync(join(tmpdir(), "test-cached-"));
      mkdirSync(join(fakeDir, ".git"), { recursive: true });
      const cloneFn = vi.fn().mockResolvedValue(fakeDir);

      await getOrClone("github:cached/repo", cloneFn);
      expect(isCached("github:cached/repo")).toBe(true);

      rmSync(fakeDir, { recursive: true, force: true });
    });
  });

  describe("stale dir re-clone", () => {
    it("re-clones when cached dir has no .git", async () => {
      const { getOrClone } = await getModule();
      const staleDir = mkdtempSync(join(tmpdir(), "test-stale-"));

      const cloneFn = vi.fn().mockResolvedValue(staleDir);
      await getOrClone("github:stale/repo", cloneFn);
      expect(cloneFn).toHaveBeenCalledTimes(1);

      const freshDir = mkdtempSync(join(tmpdir(), "test-fresh-"));
      mkdirSync(join(freshDir, ".git"), { recursive: true });

      const freshCloneFn = vi.fn().mockResolvedValue(freshDir);
      await getOrClone("github:stale/repo", freshCloneFn);
      expect(freshCloneFn).toHaveBeenCalledTimes(1);

      rmSync(staleDir, { recursive: true, force: true });
      rmSync(freshDir, { recursive: true, force: true });
    });
  });
});
