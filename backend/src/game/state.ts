import {
  GamePhase,
  MAX_PLAYERS,
  type GameRoom,
  type Player,
  type GameConfig,
  type Round,
} from "@git-blame-bet/shared";
import { generateGameCode } from "../utils/id";

const games = new Map<string, GameRoom>();

export function getGame(gameId: string): GameRoom | undefined {
  return games.get(gameId);
}

export function getAllGames(): Map<string, GameRoom> {
  return games;
}

export function createGame(config: GameConfig, adminNickname: string): GameRoom {
  const id = generateGameCode();
  const now = Date.now();

  const admin: Player = {
    nickname: adminNickname,
    avatarUrl: null,
    score: 0,
    connected: true,
    isAdmin: true,
  };

  const players = new Map<string, Player>();
  players.set(adminNickname, admin);

  const room: GameRoom = {
    id,
    phase: GamePhase.Lobby,
    config,
    players,
    rounds: [],
    currentRoundIndex: -1,
    createdAt: now,
    lastActivityAt: now,
  };

  games.set(id, room);
  return room;
}

export function addPlayer(
  gameId: string,
  nickname: string,
): { ok: true; player: Player } | { ok: false; error: string } {
  const game = games.get(gameId);
  if (!game) return { ok: false, error: "Game not found" };
  if (game.phase !== GamePhase.Lobby)
    return { ok: false, error: "Game already started" };
  if (game.players.size >= MAX_PLAYERS)
    return { ok: false, error: "Game is full" };
  if (game.players.has(nickname))
    return { ok: false, error: "Nickname already taken" };

  const player: Player = {
    nickname,
    avatarUrl: null,
    score: 0,
    connected: true,
    isAdmin: false,
  };

  game.players.set(nickname, player);
  game.lastActivityAt = Date.now();
  return { ok: true, player };
}

export function removePlayer(gameId: string, nickname: string): boolean {
  const game = games.get(gameId);
  if (!game) return false;
  return game.players.delete(nickname);
}

export function setPlayerConnected(
  gameId: string,
  nickname: string,
  connected: boolean,
): void {
  const game = games.get(gameId);
  const player = game?.players.get(nickname);
  if (player) player.connected = connected;
}

export function transitionTo(
  gameId: string,
  phase: GamePhase,
): { ok: true } | { ok: false; error: string } {
  const game = games.get(gameId);
  if (!game) return { ok: false, error: "Game not found" };

  const validTransitions: Record<GamePhase, GamePhase[]> = {
    [GamePhase.Lobby]: [GamePhase.Loading],
    [GamePhase.Loading]: [GamePhase.Ready, GamePhase.Lobby],
    [GamePhase.Ready]: [GamePhase.Playing],
    [GamePhase.Playing]: [GamePhase.Results],
    [GamePhase.Results]: [],
  };

  if (!validTransitions[game.phase].includes(phase)) {
    return {
      ok: false,
      error: `Cannot transition from ${game.phase} to ${phase}`,
    };
  }

  game.phase = phase;
  game.lastActivityAt = Date.now();
  return { ok: true };
}

export function setRounds(gameId: string, rounds: Round[]): void {
  const game = games.get(gameId);
  if (game) {
    game.rounds = rounds;
    game.currentRoundIndex = -1;
  }
}

export function advanceRound(gameId: string): Round | null {
  const game = games.get(gameId);
  if (!game) return null;

  game.currentRoundIndex++;
  if (game.currentRoundIndex >= game.rounds.length) return null;

  const round = game.rounds[game.currentRoundIndex];
  round.startedAt = Date.now();
  round.completedAt = null;
  round.answers = new Map();
  game.lastActivityAt = Date.now();
  return round;
}

export function submitAnswer(
  gameId: string,
  nickname: string,
  contributorLogin: string,
): boolean {
  const game = games.get(gameId);
  if (!game || game.phase !== GamePhase.Playing) return false;

  const round = game.rounds[game.currentRoundIndex];
  if (!round || round.completedAt || round.answers.has(nickname)) return false;

  round.answers.set(nickname, contributorLogin);
  return true;
}

export function calculateRoundScores(
  gameId: string,
): { nickname: string; correct: boolean }[] {
  const game = games.get(gameId);
  if (!game) return [];

  const round = game.rounds[game.currentRoundIndex];
  if (!round) return [];

  // Guard: only score a round once
  if (round.completedAt) return [];
  round.completedAt = Date.now();

  const results: { nickname: string; correct: boolean }[] = [];

  for (const [nickname, player] of game.players) {
    const answer = round.answers.get(nickname);
    const correct = answer === round.correctLogin;
    if (correct) player.score++;
    results.push({ nickname, correct });
  }

  return results;
}

export function getLeaderboard(gameId: string) {
  const game = games.get(gameId);
  if (!game) return [];

  return [...game.players.values()]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({
      rank: i + 1,
      nickname: p.nickname,
      avatarUrl: p.avatarUrl,
      score: p.score,
    }));
}

export function deleteGame(gameId: string): void {
  games.delete(gameId);
}
