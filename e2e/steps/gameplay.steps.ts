import { createBdd } from "playwright-bdd";
import { type Browser } from "@playwright/test";
import { GameSession } from "../support/session/GameSession";

const { Given, When, Then, Before, After } = createBdd();

type GameplayWorld = {
  session?: GameSession;
  gameId?: string;
  playerRoles: Map<string, "playerA" | "playerB">;
};

const world: GameplayWorld = {
  playerRoles: new Map<string, "playerA" | "playerB">(),
};

function resolvePlayerRole(displayName: string): "playerA" | "playerB" {
  const normalizedName = displayName.trim();
  if (!normalizedName) {
    throw new Error("Player display name cannot be empty");
  }

  const existingRole = world.playerRoles.get(normalizedName);
  if (existingRole) {
    return existingRole;
  }

  if (world.playerRoles.size === 0) {
    world.playerRoles.set(normalizedName, "playerA");
    return "playerA";
  }

  if (world.playerRoles.size === 1) {
    world.playerRoles.set(normalizedName, "playerB");
    return "playerB";
  }

  const knownPlayers = [...world.playerRoles.keys()].join(", ");
  throw new Error(
    `Only two distinct player names are supported. Third name "${normalizedName}" is not allowed. Known players: ${knownPlayers}`,
  );
}

function assertPlayerRole(
  displayName: string,
  expectedRole: "playerA" | "playerB",
  action: string,
): void {
  const resolvedRole = resolvePlayerRole(displayName);
  if (resolvedRole !== expectedRole) {
    throw new Error(
      `Player "${displayName}" is mapped to ${resolvedRole} and cannot ${action}.`,
    );
  }
}

Before(async ({ browser }: { browser: Browser }) => {
  world.session = new GameSession({
    playerANickname: "Player A",
    playerBNickname: "Player B",
    backendOrigin: process.env.E2E_BACKEND_URL ?? "http://localhost:3000",
  });

  await world.session.launch(browser);
  world.playerRoles.clear();
});

After(async () => {
  if (world.session) {
    await world.session.dispose();
    world.session = undefined;
  }
  world.gameId = undefined;
  world.playerRoles.clear();
});

Given("fixture {string} is configured for both players", async ({}, fixtureId: string) => {
  if (!world.session) throw new Error("Session was not initialized");

  if (fixtureId !== "standard-repo") {
    throw new Error(`Unsupported fixture in baseline batch: ${fixtureId}`);
  }

  await world.session.setFixture("standard-repo");
});

When("{string} creates a game using repository {string}", async ({}, playerName: string, repoUrl: string) => {
  if (!world.session) throw new Error("Session was not initialized");

  assertPlayerRole(playerName, "playerA", "create a game");

  world.gameId = await world.session.createGame(repoUrl);
});

When("{string} joins the created game", async ({}, playerName: string) => {
  if (!world.session || !world.gameId) {
    throw new Error("Missing session or game ID");
  }

  assertPlayerRole(playerName, "playerB", "join the created game");

  await world.session.joinGame(world.gameId);
});

When("{string} starts the game", async ({}, playerName: string) => {
  if (!world.session) throw new Error("Session was not initialized");

  assertPlayerRole(playerName, "playerA", "start the game");

  await world.session.startGameFromLobby();
});

Then("both players should reach the first round", async ({}) => {
  if (!world.session) throw new Error("Session was not initialized");
  await world.session.waitForRoundToStart();
});

When("players complete deterministic fixture rounds", async ({}) => {
  if (!world.session) throw new Error("Session was not initialized");
  await world.session.playFixtureGameDeterministically();
});

Then("both players should eventually see the final results", async ({}) => {
  if (!world.session) throw new Error("Session was not initialized");
  await world.session.expectResultsReady();
});

Then("{string} should win with deterministic fixture outcome", async ({}, playerName: string) => {
  if (!world.session) throw new Error("Session was not initialized");

  assertPlayerRole(playerName, "playerA", "win in deterministic fixture outcome");

  await world.session.expectWinner("Player A");
});

Then("results UI should expose deterministic podium anchor", async ({}) => {
  if (!world.session) throw new Error("Session was not initialized");
  await world.session.expectPodiumAnchorVisible();
});
