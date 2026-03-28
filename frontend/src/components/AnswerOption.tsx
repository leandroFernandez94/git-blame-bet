import type { Contributor } from "@git-blame-bet/shared";

export function AnswerOption({
  contributor,
  state,
  onClick,
}: {
  contributor: Contributor;
  state: "default" | "selected" | "correct" | "wrong";
  onClick: () => void;
}) {
  const baseClasses =
    "flex items-center gap-4 rounded-xl border-2 p-4 transition-all cursor-pointer";

  const stateClasses = {
    default: "border-gray-700 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-800",
    selected: "border-brand-500 bg-brand-500/10",
    correct: "border-green-500 bg-green-500/10",
    wrong: "border-red-500 bg-red-500/10",
  };

  return (
    <button
      className={`${baseClasses} ${stateClasses[state]}`}
      onClick={onClick}
      disabled={state !== "default"}
    >
      <img
        src={contributor.avatarUrl}
        alt={contributor.login}
        className="h-12 w-12 rounded-full"
      />
      <span className="text-lg font-medium">{contributor.login}</span>
      {state === "correct" && (
        <span className="ml-auto text-2xl text-green-400">✓</span>
      )}
      {state === "wrong" && (
        <span className="ml-auto text-2xl text-red-400">✗</span>
      )}
    </button>
  );
}
