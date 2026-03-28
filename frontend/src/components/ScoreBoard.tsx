import type { LeaderboardEntry } from "@git-blame-bet/shared";

export function ScoreBoard({
  entries,
  currentNickname,
}: {
  entries: LeaderboardEntry[];
  currentNickname: string | null;
}) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-400">Leaderboard</h3>
      <ul className="space-y-1">
        {entries.map((entry) => (
          <li
            key={entry.nickname}
            className={`flex items-center justify-between rounded px-3 py-2 text-sm ${
              entry.nickname === currentNickname
                ? "bg-brand-600/20 text-brand-100"
                : "text-gray-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-5 text-right text-xs text-gray-500">
                #{entry.rank}
              </span>
              <span className="font-medium">{entry.nickname}</span>
            </div>
            <span className="font-bold">{entry.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
