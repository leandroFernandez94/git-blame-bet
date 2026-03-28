import {
  GamePhase,
  ROUND_TIME_MS,
  ROUND_PAUSE_MS,
  type ServerMessage,
  type PlayerScore,
} from "@git-blame-bet/shared";
import {
  getGame,
  createGame,
  addPlayer,
  removePlayer,
  transitionTo,
  setRounds,
  advanceRound,
  submitAnswer,
  calculateRoundScores,
  getLeaderboard,
  deleteGame,
  setPlayerConnected,
} from "./state";
import { processRepo } from "./repo-processor";
import { scheduleGameCleanup } from "../utils/cleanup";

type BroadcastFn = (gameId: string, message: ServerMessage) => void;
type SendFn = (gameId: string, nickname: string, message: ServerMessage) => void;

let broadcast: BroadcastFn = () => {};
let sendToPlayer: SendFn = () => {};

const roundTimers = new Map<string, { timeout: Timer; interval: Timer }>();

export function setBroadcast(fn: BroadcastFn): void {
  broadcast = fn;
}

export function setSendToPlayer(fn: SendFn): void {
  sendToPlayer = fn;
}

export function handleCreateGame(repoUrl: string, nickname: string): string {
  const room = createGame({ repoUrl }, nickname);
  scheduleGameCleanup(room.id, () => deleteGame(room.id));
  return room.id;
}

export function handleJoinGame(
  gameId: string,
  nickname: string,
): { ok: true } | { ok: false; error: string } {
  const result = addPlayer(gameId, nickname);
  if (!result.ok) return result;

  broadcast(gameId, {
    type: "lobby:player_joined",
    payload: result.player,
  });

  const game = getGame(gameId)!;
  sendToPlayer(gameId, nickname, {
    type: "lobby:state",
    payload: {
      players: [...game.players.values()],
      repoUrl: game.config.repoUrl,
    },
  });

  return { ok: true };
}

export function handleLeaveGame(gameId: string, nickname: string): void {
  const game = getGame(gameId);
  if (!game) return;

  if (game.phase === GamePhase.Lobby) {
    removePlayer(gameId, nickname);
  } else {
    setPlayerConnected(gameId, nickname, false);
  }

  broadcast(gameId, {
    type: "lobby:player_left",
    payload: { nickname },
  });
}

export async function handleStartLoading(gameId: string): Promise<void> {
  const game = getGame(gameId);
  if (!game) return;

  const result = transitionTo(gameId, GamePhase.Loading);
  if (!result.ok) {
    broadcast(gameId, {
      type: "error",
      payload: { code: "TRANSITION_FAILED", message: result.error },
    });
    return;
  }

  broadcast(gameId, {
    type: "game:loading",
    payload: { step: "Starting...", progress: 0 },
  });

  try {
    const { rounds } = await processRepo(
      game.config.repoUrl,
      game.config.pathFilter,
      (step, progress) => {
        broadcast(gameId, {
          type: "game:loading",
          payload: { step, progress },
        });
      },
    );

    setRounds(gameId, rounds);
    transitionTo(gameId, GamePhase.Ready);
    broadcast(gameId, { type: "game:ready" });
  } catch (err) {
    transitionTo(gameId, GamePhase.Lobby);
    broadcast(gameId, {
      type: "error",
      payload: {
        code: "LOADING_FAILED",
        message: err instanceof Error ? err.message : "Failed to process repo",
      },
    });
  }
}

export function handleStartGame(gameId: string): void {
  const game = getGame(gameId);
  if (!game || game.phase !== GamePhase.Ready) return;

  transitionTo(gameId, GamePhase.Playing);
  startNextRound(gameId);
}

function startNextRound(gameId: string): void {
  const round = advanceRound(gameId);
  if (!round) {
    endGame(gameId);
    return;
  }

  broadcast(gameId, {
    type: "round:start",
    payload: {
      roundIndex: round.index,
      snippet: round.snippet,
      language: round.language,
      options: round.options,
      timeLimit: round.timeLimit,
    },
  });

  let remaining = Math.floor(ROUND_TIME_MS / 1000);
  const tickInterval = setInterval(() => {
    remaining--;
    if (remaining > 0) {
      broadcast(gameId, {
        type: "round:tick",
        payload: { remaining: remaining * 1000 },
      });
    }
  }, 1000);

  const timer = setTimeout(() => {
    clearInterval(tickInterval);
    endRound(gameId);
  }, ROUND_TIME_MS);

  roundTimers.set(gameId, { timeout: timer, interval: tickInterval });
}

function endRound(gameId: string): void {
  const game = getGame(gameId);
  if (!game) return;

  const results = calculateRoundScores(gameId);
  const round = game.rounds[game.currentRoundIndex];

  const scores: PlayerScore[] = [...game.players.values()].map((p) => {
    const answered = round.answers.has(p.nickname);
    const correct =
      round.answers.get(p.nickname) === round.correctLogin;
    return {
      nickname: p.nickname,
      score: p.score,
      correct: results.filter((r) => r.nickname === p.nickname && r.correct)
        .length,
      wrong: answered && !correct ? 1 : 0,
      timedOut: !answered ? 1 : 0,
    };
  });

  broadcast(gameId, {
    type: "round:result",
    payload: {
      correctLogin: round.correctLogin,
      scores,
      roundIndex: round.index,
    },
  });

  setTimeout(() => {
    startNextRound(gameId);
  }, ROUND_PAUSE_MS);
}

function endGame(gameId: string): void {
  const timers = roundTimers.get(gameId);
  if (timers) {
    clearTimeout(timers.timeout);
    clearInterval(timers.interval);
    roundTimers.delete(gameId);
  }

  transitionTo(gameId, GamePhase.Results);

  broadcast(gameId, {
    type: "game:results",
    payload: { leaderboard: getLeaderboard(gameId) },
  });

  scheduleGameCleanup(gameId, () => deleteGame(gameId), 300_000);
}

export function handleSubmitAnswer(
  gameId: string,
  nickname: string,
  contributorLogin: string,
): void {
  const success = submitAnswer(gameId, nickname, contributorLogin);
  if (!success) return;

  const game = getGame(gameId);
  if (!game) return;

  const round = game.rounds[game.currentRoundIndex];
  const allAnswered = [...game.players.keys()].every(
    (n) => round.answers.has(n) || !game.players.get(n)?.connected,
  );

  if (allAnswered) {
    const timers = roundTimers.get(gameId);
    if (timers) {
      clearTimeout(timers.timeout);
      clearInterval(timers.interval);
      roundTimers.delete(gameId);
    }
    endRound(gameId);
  }
}
