import { rmSync } from "node:fs";
import { GAME_TTL_MS } from "@git-blame-bet/shared";

const activeTimers = new Map<string, Timer>();

export function scheduleTempCleanup(dir: string, delayMs = 60_000): void {
  setTimeout(() => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {}
  }, delayMs);
}

export function scheduleGameCleanup(
  gameId: string,
  cleanupFn: () => void,
  ttl = GAME_TTL_MS,
): void {
  clearGameCleanup(gameId);
  const timer = setTimeout(() => {
    cleanupFn();
    activeTimers.delete(gameId);
  }, ttl);
  activeTimers.set(gameId, timer);
}

export function clearGameCleanup(gameId: string): void {
  const existing = activeTimers.get(gameId);
  if (existing) {
    clearTimeout(existing);
    activeTimers.delete(gameId);
  }
}

export function refreshActivity(gameId: string, cleanupFn: () => void): void {
  scheduleGameCleanup(gameId, cleanupFn);
}
