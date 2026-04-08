import type { Contributor } from "./repo";

export enum GamePhase {
  Lobby = "lobby",
  Loading = "loading",
  Ready = "ready",
  Playing = "playing",
  Results = "results",
}

export type Player = {
  nickname: string;
  avatarUrl: string | null;
  score: number;
  connected: boolean;
  isAdmin: boolean;
};

export type GameConfig = {
  repoUrl: string;
  pathFilter?: string;
  fileTypes?: string[];
};

export type Round = {
  index: number;
  snippet: string;
  language: string;
  filePath: string;
  startLine: number;
  correctLogin: string;
  options: Contributor[];
  answers: Map<string, string>;
  startedAt: number | null;
  completedAt: number | null;
  timeLimit: number;
};

export type GameRoom = {
  id: string;
  phase: GamePhase;
  config: GameConfig;
  players: Map<string, Player>;
  rounds: Round[];
  currentRoundIndex: number;
  createdAt: number;
  lastActivityAt: number;
};

export type PlayerScore = {
  nickname: string;
  score: number;
  correct: number;
  wrong: number;
  timedOut: number;
};

export type LeaderboardEntry = {
  rank: number;
  nickname: string;
  avatarUrl: string | null;
  score: number;
};

export type Question = {
  roundIndex: number;
  snippet: string;
  language: string;
  options: Contributor[];
  timeLimit: number;
};
