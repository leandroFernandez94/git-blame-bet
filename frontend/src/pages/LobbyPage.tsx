import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGame } from "../context/GameContext";
import { PlayerList } from "../components/PlayerList";
import { GameFilters } from "../components/GameFilters";

export function LobbyPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { state, sendMessage } = useGame();
  const [pathFilter, setPathFilter] = useState("");
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const joinLink = `${window.location.origin}/play/${gameId}`;

  useEffect(() => {
    if (gameId) {
      fetch(`/api/qr/${gameId}`)
        .then((r) => r.json())
        .then((data) => setQrUrl(data.qr))
        .catch(() => {});
    }
  }, [gameId]);

  useEffect(() => {
    if (state.phase === "loading" || state.phase === "ready") {
      navigate(`/playing/${gameId}`);
    }
  }, [state.phase, gameId, navigate]);

  const handleCopy = () => {
    navigator.clipboard.writeText(joinLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStart = () => {
    sendMessage({ type: "game:start" });
  };

  const handleApplyFilters = () => {
    // filters are applied on start through game config
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Game Lobby</h2>
        <p className="mt-1 text-sm text-gray-400">
          Share the link below to invite players
        </p>
      </div>

      <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
        <label className="mb-2 block text-xs text-gray-500">
          Invite link
        </label>
        <div className="flex gap-2">
          <input
            readOnly
            value={joinLink}
            className="flex-1 rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-300"
          />
          <button
            onClick={handleCopy}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {qrUrl && (
        <div className="flex justify-center">
          <img
            src={qrUrl}
            alt="QR Code"
            className="h-48 w-48 rounded-lg bg-white p-2"
          />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <PlayerList players={state.players} />
        <GameFilters
          pathFilter={pathFilter}
          onPathChange={setPathFilter}
          onApply={handleApplyFilters}
        />
      </div>

      {state.isAdmin && (
        <button
          onClick={handleStart}
          disabled={state.players.length < 1}
          className="w-full rounded-lg bg-green-600 px-4 py-3 text-lg font-bold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Start Game
        </button>
      )}

      {state.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {state.error}
        </div>
      )}
    </div>
  );
}
