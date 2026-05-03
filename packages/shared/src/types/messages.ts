import type { Contributor } from "./repo";
import type { Player, PlayerScore, LeaderboardEntry } from "./game";

export type LobbyCreateMessage = {
  type: "lobby:create";
  payload: { repoUrl: string; nickname: string; azureDevOpsToken?: string };
};

export type LobbyJoinMessage = {
  type: "lobby:join";
  payload: { gameId: string; nickname: string };
};

export type GameStartMessage = {
  type: "game:start";
};

export type RoundAnswerMessage = {
  type: "round:answer";
  payload: { contributorLogin: string };
};

export type ClientMessage =
  | LobbyCreateMessage
  | LobbyJoinMessage
  | GameStartMessage
  | RoundAnswerMessage;

export type LobbyCreatedMessage = {
  type: "lobby:created";
  payload: { gameId: string; gameUrl: string; qrDataUrl: string };
};

export type LobbyStateMessage = {
  type: "lobby:state";
  payload: { players: Player[]; repoUrl: string };
};

export type LobbyPlayerJoinedMessage = {
  type: "lobby:player_joined";
  payload: Player;
};

export type LobbyPlayerLeftMessage = {
  type: "lobby:player_left";
  payload: { nickname: string };
};

export type GameLoadingMessage = {
  type: "game:loading";
  payload: { step: string; progress: number };
};

export type GameReadyMessage = {
  type: "game:ready";
};

export type RoundStartMessage = {
  type: "round:start";
  payload: {
    roundIndex: number;
    snippet: string;
    language: string;
    options: Contributor[];
    timeLimit: number;
  };
};

export type RoundTickMessage = {
  type: "round:tick";
  payload: { remaining: number };
};

export type RoundResultMessage = {
  type: "round:result";
  payload: {
    correctLogin: string;
    scores: PlayerScore[];
    roundIndex: number;
  };
};

export type GameResultsMessage = {
  type: "game:results";
  payload: { leaderboard: LeaderboardEntry[] };
};

export type ErrorMessage = {
  type: "error";
  payload: { code: string; message: string };
};

export type ServerMessage =
  | LobbyCreatedMessage
  | LobbyStateMessage
  | LobbyPlayerJoinedMessage
  | LobbyPlayerLeftMessage
  | GameLoadingMessage
  | GameReadyMessage
  | RoundStartMessage
  | RoundTickMessage
  | RoundResultMessage
  | GameResultsMessage
  | ErrorMessage;
