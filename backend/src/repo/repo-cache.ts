import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProviderRepoRef } from "../providers/types";

const cacheMap = new Map<string, Promise<string>>();
const cacheDir = join(tmpdir(), "gbb-cache");

export function sanitizeKey(key: string): string {
  return key.replace(/[:/]/g, "_");
}

export function getCacheKey(ref: ProviderRepoRef): string {
  switch (ref.provider) {
    case "github":
      return `github:${ref.owner}/${ref.repo}`;
    case "azure-devops":
      return `ado:${ref.org}/${ref.project}/${ref.repo}`;
  }
}

export function isCached(cacheKey: string): boolean {
  const promise = cacheMap.get(cacheKey);
  if (!promise) return false;

  const dir = join(cacheDir, sanitizeKey(cacheKey));
  return existsSync(join(dir, ".git"));
}

export async function getOrClone(
  cacheKey: string,
  cloneFn: () => Promise<string>,
): Promise<string> {
  const existing = cacheMap.get(cacheKey);
  if (existing) {
    const dir = await existing;
    if (existsSync(join(dir, ".git"))) {
      return dir;
    }
    rmSync(dir, { recursive: true, force: true });
    cacheMap.delete(cacheKey);
  }

  const clonePromise = cloneFn().then((dir) => {
    console.log(`[cache] Cached ${cacheKey} -> ${dir}`);
    return dir;
  });

  cacheMap.set(cacheKey, clonePromise);

  try {
    return await clonePromise;
  } catch (err) {
    cacheMap.delete(cacheKey);
    throw err;
  }
}
