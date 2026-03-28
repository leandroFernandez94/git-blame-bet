import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGame } from "../context/GameContext";

export function JoinPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { state, connect, sendMessage, dispatch, connectionStatus } = useGame();
  const [nickname, setNickname] = useState("");
  const [joined, setJoined] = useState(false);
  const pendingJoin = useRef<{ gameId: string; nickname: string } | null>(null);

  useEffect(() => {
    if (connectionStatus === "connected" && pendingJoin.current) {
      const { gameId: gId, nickname: nick } = pendingJoin.current;
      pendingJoin.current = null;
      dispatch({
        type: "SET_IDENTITY",
        gameId: gId,
        nickname: nick,
        isAdmin: false,
      });
      sendMessage({
        type: "lobby:join",
        payload: { gameId: gId, nickname: nick },
      });
      setJoined(true);
    }
  }, [connectionStatus, sendMessage, dispatch]);

  useEffect(() => {
    if (state.phase === "playing" || state.phase === "loading") {
      navigate(`/playing/${gameId}`);
    }
    if (state.phase === "results") {
      navigate(`/results/${gameId}`);
    }
  }, [state.phase, gameId, navigate]);

  const handleJoin = () => {
    if (!nickname.trim() || !gameId) return;
    pendingJoin.current = { gameId, nickname: nickname.trim() };
    connect();
  };

  if (joined) {
    return (
      <div className="flex flex-col items-center gap-6 pt-16">
        <h2 className="text-2xl font-bold">Waiting for game to start...</h2>
        <p className="text-gray-400">
          {state.players.length} player(s) connected
        </p>
        <div className="space-y-2">
          {state.players.map((p) => (
            <div
              key={p.nickname}
              className="rounded-md bg-gray-800 px-4 py-2 text-sm animate-fade-in"
            >
              {p.nickname} {p.isAdmin && "(Admin)"}
            </div>
          ))}
        </div>
        {state.error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {state.error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8 pt-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Join Game</h1>
        <p className="mt-2 text-gray-400">
          Enter your nickname to join the game
        </p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Your nickname"
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none"
          maxLength={20}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
        />
        <button
          onClick={handleJoin}
          disabled={!nickname.trim()}
          className="w-full rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Join
        </button>
      </div>

      {state.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {state.error}
        </div>
      )}
    </div>
  );
}
