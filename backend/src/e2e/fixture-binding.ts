import type { MockFixtureId } from "@git-blame-bet/shared";

const fixtureBindings = new Map<string, MockFixtureId>();

export function bindFixtureToGame(gameId: string, fixtureId: MockFixtureId): void {
  fixtureBindings.set(gameId, fixtureId);
}

export function getFixtureForGame(gameId: string): MockFixtureId | undefined {
  return fixtureBindings.get(gameId);
}

export function unbindFixtureForGame(gameId: string): void {
  fixtureBindings.delete(gameId);
}
