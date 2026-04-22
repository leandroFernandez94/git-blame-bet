import { mkdirSync, mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getOrClone, sanitizeKey } from "./repo-cache";

const CLONE_TIMEOUT_MS = 120_000;
const CACHE_ROOT = join(tmpdir(), "gbb-cache");

/**
 * Strip embedded PATs from clone URLs before logging or error reporting.
 * Matches patterns like `https://{PAT}@dev.azure.com/...`
 */
export function sanitizeCloneUrl(url: string): string {
  return url.replace(/https:\/\/[^@]+@/g, "https://***@");
}

function cloneInto(repoUrl: string, dir: string): Promise<string> {
  const start = performance.now();
  console.log(`[clone] Starting full clone of ${sanitizeCloneUrl(repoUrl)} into ${dir}`);

  const proc = Bun.spawn(
    ["git", "clone", "--single-branch", repoUrl, dir],
    { stdout: "ignore", stderr: "pipe" },
  );

  const timer = setTimeout(() => proc.kill(), CLONE_TIMEOUT_MS);

  return proc.exited.then((exitCode) => {
    clearTimeout(timer);

    if (exitCode !== 0) {
      return new Response(proc.stderr).text().then((stderr) => {
        const safeStderr = sanitizeCloneUrl(stderr.slice(0, 200));
        console.log(`[clone] FAILED (exit ${exitCode}) after ${((performance.now() - start) / 1000).toFixed(1)}s: ${safeStderr}`);
        throw new Error(
          exitCode === null || exitCode === 137
            ? "Repository clone timed out (2 min limit). Try a smaller repo."
            : `Git clone failed: ${safeStderr}`,
        );
      });
    }

    console.log(`[clone] Done in ${((performance.now() - start) / 1000).toFixed(1)}s -> ${dir}`);
    return dir;
  });
}

export async function cloneRepo(repoUrl: string, cacheKey?: string): Promise<string> {
  if (!cacheKey) {
    const dir = mkdtempSync(join(tmpdir(), "gbb-"));
    return cloneInto(repoUrl, dir);
  }

  const sanitized = sanitizeKey(cacheKey);
  const targetDir = join(CACHE_ROOT, sanitized);

  return getOrClone(cacheKey, async () => {
    mkdirSync(CACHE_ROOT, { recursive: true });
    if (existsSync(targetDir)) {
      rmSync(targetDir, { recursive: true, force: true });
    }
    return cloneInto(repoUrl, targetDir);
  });
}
