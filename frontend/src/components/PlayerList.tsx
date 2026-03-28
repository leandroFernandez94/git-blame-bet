import type { Player } from "@git-blame-bet/shared";
import { MAX_PLAYERS } from "@git-blame-bet/shared";

export function PlayerList({ players }: { players: Player[] }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
      <div className="mb-3 flex items-center justify-between text-sm text-gray-400">
        <span>Players</span>
        <span>
          {players.length}/{MAX_PLAYERS}
        </span>
      </div>
      <ul className="space-y-2">
        {players.map((p) => (
          <li
            key={p.nickname}
            className="flex items-center gap-3 rounded-md bg-gray-800/50 px-3 py-2 animate-fade-in"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold uppercase">
              {p.nickname.slice(0, 2)}
            </div>
            <span className="text-sm font-medium">{p.nickname}</span>
            {p.isAdmin && (
              <span className="ml-auto rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-400">
                Admin
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
