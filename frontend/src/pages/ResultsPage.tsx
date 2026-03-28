import { useGame } from "../context/GameContext";
import { ScoreBoard } from "../components/ScoreBoard";

export function ResultsPage() {
  const { state } = useGame();

  const podium = state.leaderboard.slice(0, 3);
  const rest = state.leaderboard.slice(3);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-8 pt-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Game Over!</h1>
        <p className="mt-2 text-gray-400">Final standings</p>
      </div>

      <div className="flex items-end justify-center gap-4">
        {podium.map((_entry, i) => {
          const heights = ["h-32", "h-24", "h-20"];
          const order = podium.length === 3 ? [1, 0, 2] : [0, 1, 2];
          const idx = order[i] ?? i;
          const player = podium[idx];
          if (!player) return null;

          return (
            <div key={player.nickname} className="flex flex-col items-center gap-2">
              <span className="text-3xl">{medals[idx]}</span>
              <span className="text-sm font-bold">{player.nickname}</span>
              <span className="text-2xl font-bold text-brand-500">
                {player.score}
              </span>
              <div
                className={`${heights[idx]} w-20 rounded-t-lg ${
                  idx === 0
                    ? "bg-yellow-500/30"
                    : idx === 1
                      ? "bg-gray-400/20"
                      : "bg-orange-500/20"
                }`}
              />
            </div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <ScoreBoard entries={state.leaderboard} currentNickname={state.nickname} />
      )}

      <div className="flex justify-center">
        <a
          href="/"
          className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          Play Again
        </a>
      </div>
    </div>
  );
}
