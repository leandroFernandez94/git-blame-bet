import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { writeProcessState, type ManagedProcess } from "./process-state";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

type Spawned = {
  name: ManagedProcess["name"];
  process: ReturnType<typeof spawn>;
};

async function waitForHealth(url: string): Promise<void> {
  const maxAttempts = 60;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // keep waiting
    }
    await delay(500);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function spawnWorkspaceProcess({
  name,
  script,
  cwd,
  env,
}: {
  name: Spawned["name"];
  script: "dev";
  cwd: string;
  env?: Record<string, string>;
}): Spawned {
  const child = spawn("bun", ["run", script], {
    cwd,
    env: {
      ...process.env,
      ...env,
    },
    stdio: "inherit",
    detached: true,
  });

  child.unref();

  return {
    name,
    process: child,
  };
}

export default async function globalSetup(): Promise<void> {
  const spawned: Spawned[] = [];

  try {
    const backend = spawnWorkspaceProcess({
      name: "backend",
      script: "dev",
      cwd: resolve(ROOT, "backend"),
      env: {
        PORT: "3000",
        PUBLIC_URL: "http://localhost:5173",
        E2E_FIXTURE_ROUTING: "1",
      },
    });

    const frontend = spawnWorkspaceProcess({
      name: "frontend",
      script: "dev",
      cwd: resolve(ROOT, "frontend"),
    });

    spawned.push(backend, frontend);

    await waitForHealth("http://localhost:3000/api/health");
    await waitForHealth("http://localhost:5173");

    writeProcessState(
      spawned
        .filter((entry) => Boolean(entry.process.pid))
        .map((entry) => ({
          name: entry.name,
          pid: entry.process.pid!,
        })),
    );
  } catch (error) {
    for (const entry of spawned) {
      if (entry.process.pid) {
        try {
          process.kill(-entry.process.pid, "SIGTERM");
        } catch {
          // best effort cleanup
        }
      }
    }
    throw error;
  }
}
