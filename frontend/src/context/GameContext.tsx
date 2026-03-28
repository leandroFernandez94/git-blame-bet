import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from "react";
import type {
  Player,
  ServerMessage,
  Contributor,
  PlayerScore,
  LeaderboardEntry,
  ClientMessage,
} from "@git-blame-bet/shared";
import { useWebSocket, type ConnectionStatus } from "../hooks/useWebSocket";

type GameState = {
  gameId: string | null;
  nickname: string | null;
  isAdmin: boolean;
  phase: "idle" | "lobby" | "loading" | "ready" | "playing" | "results";
  players: Player[];
  repoUrl: string | null;
  loadingStep: string;
  loadingProgress: number;
  currentRound: {
    roundIndex: number;
    snippet: string;
    language: string;
    options: Contributor[];
    timeLimit: number;
  } | null;
  roundResult: {
    correctLogin: string;
    scores: PlayerScore[];
    roundIndex: number;
  } | null;
  timeRemaining: number;
  selectedAnswer: string | null;
  leaderboard: LeaderboardEntry[];
  error: string | null;
};

type GameAction =
  | { type: "SET_IDENTITY"; gameId?: string; nickname: string; isAdmin: boolean }
  | { type: "PROCESS_MESSAGE"; message: ServerMessage }
  | { type: "SELECT_ANSWER"; login: string }
  | { type: "CLEAR_ERROR" }
  | { type: "RESET" };

const initialState: GameState = {
  gameId: null,
  nickname: null,
  isAdmin: false,
  phase: "idle",
  players: [],
  repoUrl: null,
  loadingStep: "",
  loadingProgress: 0,
  currentRound: null,
  roundResult: null,
  timeRemaining: 0,
  selectedAnswer: null,
  leaderboard: [],
  error: null,
};

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "SET_IDENTITY":
      return {
        ...state,
        gameId: action.gameId ?? state.gameId,
        nickname: action.nickname,
        isAdmin: action.isAdmin,
      };

    case "PROCESS_MESSAGE": {
      const msg = action.message;
      switch (msg.type) {
        case "lobby:created":
          return { ...state, gameId: msg.payload.gameId, phase: "lobby" };
        case "lobby:state":
          return {
            ...state,
            players: msg.payload.players,
            repoUrl: msg.payload.repoUrl,
            phase: state.phase === "idle" ? "lobby" : state.phase,
          };
        case "lobby:player_joined":
          return {
            ...state,
            players: [...state.players, msg.payload],
          };
        case "lobby:player_left":
          return {
            ...state,
            players: state.players.filter(
              (p) => p.nickname !== msg.payload.nickname,
            ),
          };
        case "game:loading":
          return {
            ...state,
            phase: "loading",
            loadingStep: msg.payload.step,
            loadingProgress: msg.payload.progress,
          };
        case "game:ready":
          return { ...state, phase: "ready" };
        case "round:start":
          return {
            ...state,
            phase: "playing",
            currentRound: msg.payload,
            roundResult: null,
            selectedAnswer: null,
            timeRemaining: msg.payload.timeLimit,
          };
        case "round:tick":
          return { ...state, timeRemaining: msg.payload.remaining };
        case "round:result":
          return { ...state, roundResult: msg.payload };
        case "game:results":
          return {
            ...state,
            phase: "results",
            leaderboard: msg.payload.leaderboard,
          };
        case "error":
          return {
            ...state,
            error: msg.payload.message,
            phase: state.phase === "loading" ? "lobby" : state.phase,
          };
        default:
          return state;
      }
    }

    case "SELECT_ANSWER":
      return { ...state, selectedAnswer: action.login };

    case "CLEAR_ERROR":
      return { ...state, error: null };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

type GameContextValue = {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  connectionStatus: ConnectionStatus;
  connect: () => void;
  sendMessage: (msg: ClientMessage) => void;
  disconnect: () => void;
};

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  const handleMessage = useCallback((msg: ServerMessage) => {
    dispatch({ type: "PROCESS_MESSAGE", message: msg });
  }, []);

  const { status, sendMessage, connect, disconnect } =
    useWebSocket(handleMessage);

  const value: GameContextValue = {
    state,
    dispatch,
    connectionStatus: status,
    connect,
    sendMessage,
    disconnect,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
