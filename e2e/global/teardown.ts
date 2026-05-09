import { clearProcessState, readProcessState } from "./process-state";

function killProcessGroup(pid: number): void {
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    // best effort
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default async function globalTeardown(): Promise<void> {
  const processes = readProcessState();

  const backend = processes.find((entry) => entry.name === "backend");
  if (backend) {
    killProcessGroup(backend.pid);
  }

  await wait(300);

  const frontend = processes.find((entry) => entry.name === "frontend");
  if (frontend) {
    killProcessGroup(frontend.pid);
  }

  clearProcessState();
}
