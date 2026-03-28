import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../context/GameContext";

export function HomePage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [nickname, setNickname] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { connect, sendMessage, state, dispatch, connectionStatus } = useGame();
  const navigate = useNavigate();
  const pendingCreate = useRef<{ repoUrl: string; nickname: string } | null>(
    null,
  );

  useEffect(() => {
    if (connectionStatus === "connected" && pendingCreate.current) {
      const { repoUrl: repo, nickname: nick } = pendingCreate.current;
      pendingCreate.current = null;
      dispatch({
        type: "SET_IDENTITY",
        nickname: nick,
        isAdmin: true,
      });
      sendMessage({
        type: "lobby:create",
        payload: { repoUrl: repo, nickname: nick },
      });
    }
    if (connectionStatus === "disconnected" && isCreating) {
      setIsCreating(false);
    }
  }, [connectionStatus, sendMessage, dispatch, isCreating]);

  useEffect(() => {
    if (state.gameId) {
      navigate(`/game/${state.gameId}`);
    }
  }, [state.gameId, navigate]);

  const handleCreate = () => {
    if (!repoUrl.trim() || !nickname.trim()) return;
    setIsCreating(true);
    pendingCreate.current = {
      repoUrl: repoUrl.trim(),
      nickname: nickname.trim(),
    };
    connect();
  };

  return (
    <div className="flex flex-col items-center gap-8 pt-16">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          <span className="text-brand-500">Git</span> Blame Bet
        </h1>
        <p className="mt-3 text-gray-400">
          Guess who wrote the code. Challenge your team!
        </p>
      </div>

      <div className="w-full max-w-md space-y-4">
        <div>
          <label className="mb-1 block text-sm text-gray-400">
            Your nickname
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Enter your nickname"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none"
            maxLength={20}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-400">
            GitHub repository URL
          </label>
          <input
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none"
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={!repoUrl.trim() || !nickname.trim() || isCreating}
          className="w-full rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCreating ? "Creating game..." : "Create Game"}
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
