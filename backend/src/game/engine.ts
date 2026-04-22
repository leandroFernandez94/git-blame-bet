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
import { processRepo } from "../repo/processor";
import { createProvider } from "../providers";
import { scheduleGameCleanup } from "../utils/cleanup";

type BroadcastFn = (gameId: string, message: ServerMessage) => void;
type SendFn = (
  gameId: string,
  nickname: string,
  message: ServerMessage,
) => void;

export interface EngineDeps {
  broadcast: BroadcastFn;
  sendToPlayer: SendFn;
}

export function createEngine({ broadcast, sendToPlayer }: EngineDeps) {
  const roundTimers = new Map<string, { timeout: Timer; interval: Timer }>();
  const feedbackTimers = new Map<string, Timer>();
  const roundEnded = new Set<string>();

  function handleCreateGame(repoUrl: string, nickname: string, azureDevOpsToken?: string): string {
    const room = createGame({ repoUrl, azureDevOpsToken }, nickname);
    scheduleGameCleanup(room.id, () => deleteGame(room.id));
    return room.id;
  }

  function handleJoinGame(
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

  function handleLeaveGame(gameId: string, nickname: string): void {
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

  async function handleStartLoading(gameId: string): Promise<void> {
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
      const provider = createProvider(game.config.repoUrl, game.config.azureDevOpsToken);
      const { rounds } = await processRepo(
        game.config.repoUrl,
        game.config.pathFilter,
        (step, progress) => {
          broadcast(gameId, {
            type: "game:loading",
            payload: { step, progress },
          });
        },
        provider,
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
          message:
            err instanceof Error ? err.message : "Failed to process repo",
        },
      });
    }
  }

  function handleStartGame(gameId: string): void {
    const game = getGame(gameId);
    if (!game || game.phase !== GamePhase.Ready) return;

    transitionTo(gameId, GamePhase.Playing);
    startNextRound(gameId);
  }

  function startNextRound(gameId: string): void {
    roundEnded.delete(gameId);

    const round = advanceRound(gameId);
    if (!round) {
      console.log(`[engine] No more rounds for game ${gameId}, ending game`);
      endGame(gameId);
      return;
    }

    console.log(`[engine] Starting round ${round.index} (game ${gameId})`);

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

    if (game.phase !== GamePhase.Playing) {
      console.warn(`[engine] endRound called but phase is ${game.phase}, ignoring`);
      return;
    }

    // Prevent double-ending the same round (timer + last answer race)
    if (roundEnded.has(gameId)) {
      console.warn(`[engine] endRound already called for game ${gameId} round ${game.currentRoundIndex}, ignoring`);
      return;
    }
    roundEnded.add(gameId);

    // Clear any existing feedback timer
    const existingFeedback = feedbackTimers.get(gameId);
    if (existingFeedback) {
      clearTimeout(existingFeedback);
      feedbackTimers.delete(gameId);
    }

    const results = calculateRoundScores(gameId);
    const round = game.rounds[game.currentRoundIndex];

    const scores: PlayerScore[] = [...game.players.values()].map((p) => {
      const answered = round.answers.has(p.nickname);
      const correct = round.answers.get(p.nickname) === round.correctLogin;
      return {
        nickname: p.nickname,
        score: p.score,
        correct: results.filter((r) => r.nickname === p.nickname && r.correct)
          .length,
        wrong: answered && !correct ? 1 : 0,
        timedOut: !answered ? 1 : 0,
      };
    });

    console.log(`[engine] Round ${round.index} ended (game ${gameId}), scheduling next in ${ROUND_PAUSE_MS}ms`);

    broadcast(gameId, {
      type: "round:result",
      payload: {
        correctLogin: round.correctLogin,
        scores,
        roundIndex: round.index,
      },
    });

    const feedbackTimer = setTimeout(() => {
      feedbackTimers.delete(gameId);
      try {
        startNextRound(gameId);
      } catch (err) {
        console.error(`[engine] Error in startNextRound after feedback:`, err);
      }
    }, ROUND_PAUSE_MS);
    feedbackTimers.set(gameId, feedbackTimer);
  }

  function endGame(gameId: string): void {
    roundEnded.delete(gameId);

    const timers = roundTimers.get(gameId);
    if (timers) {
      clearTimeout(timers.timeout);
      clearInterval(timers.interval);
      roundTimers.delete(gameId);
    }

    const feedback = feedbackTimers.get(gameId);
    if (feedback) {
      clearTimeout(feedback);
      feedbackTimers.delete(gameId);
    }

    transitionTo(gameId, GamePhase.Results);

    broadcast(gameId, {
      type: "game:results",
      payload: { leaderboard: getLeaderboard(gameId) },
    });

    scheduleGameCleanup(gameId, () => deleteGame(gameId), 300_000);
  }

  function handleSubmitAnswer(
    gameId: string,
    nickname: string,
    contributorLogin: string,
  ): void {
    // Reject answers during feedback phase
    if (roundEnded.has(gameId)) return;

    const success = submitAnswer(gameId, nickname, contributorLogin);
    if (!success) return;

    const game = getGame(gameId);
    if (!game) return;

    const round = game.rounds[game.currentRoundIndex];
    const allAnswered = [...game.players.keys()].every(
      (n) => round.answers.has(n) || !game.players.get(n)?.connected,
    );

    console.log(`[engine] Answer from ${nickname} (game ${gameId}, round ${game.currentRoundIndex}). All answered: ${allAnswered} (${round.answers.size}/${game.players.size})`);

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

  return {
    handleCreateGame,
    handleJoinGame,
    handleLeaveGame,
    handleStartLoading,
    handleStartGame,
    handleSubmitAnswer,
  } as const;
}

export type GameEngine = ReturnType<typeof createEngine>;
