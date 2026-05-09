import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type ManagedProcess = {
  name: "backend" | "frontend";
  pid: number;
};

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const stateFilePath = resolve(currentDir, "../.tmp/processes.json");

export function writeProcessState(processes: ManagedProcess[]): void {
  mkdirSync(dirname(stateFilePath), { recursive: true });
  writeFileSync(stateFilePath, JSON.stringify(processes, null, 2), "utf8");
}

export function readProcessState(): ManagedProcess[] {
  if (!existsSync(stateFilePath)) return [];

  const raw = readFileSync(stateFilePath, "utf8");
  try {
    return JSON.parse(raw) as ManagedProcess[];
  } catch {
    return [];
  }
}

export function clearProcessState(): void {
  if (existsSync(stateFilePath)) {
    rmSync(stateFilePath, { force: true });
  }
}
