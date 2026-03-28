import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ROUNDS_COUNT, ROUND_TIME_MS } from "@git-blame-bet/shared";
import { useGame } from "../context/GameContext";
import { SnippetDisplay } from "../components/SnippetDisplay";
import { AnswerOption } from "../components/AnswerOption";
import { Timer } from "../components/Timer";
import { ConfettiEffect } from "../components/ConfettiEffect";

export function PlayingPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { state, sendMessage, dispatch } = useGame();

  useEffect(() => {
    if (state.phase === "results") {
      navigate(`/results/${gameId}`);
    }
    if (state.phase === "lobby") {
      navigate(`/game/${gameId}`);
    }
  }, [state.phase, gameId, navigate]);

  if (state.phase === "loading") {
    return (
      <div className="flex flex-col items-center gap-6 pt-24">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-gray-700 border-t-brand-500" />
        <h2 className="text-xl font-bold">Preparing Game...</h2>
        <p className="text-sm text-gray-400">{state.loadingStep}</p>
        <div className="h-2 w-64 overflow-hidden rounded-full bg-gray-800">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-500"
            style={{ width: `${state.loadingProgress * 100}%` }}
          />
        </div>
      </div>
    );
  }

  if (state.phase === "ready") {
    return (
      <div className="flex flex-col items-center gap-6 pt-24">
        <h2 className="text-2xl font-bold text-green-400">Game Ready!</h2>
        <p className="text-gray-400">Waiting for admin to start...</p>
        {state.isAdmin && (
          <button
            onClick={() => sendMessage({ type: "game:start" })}
            className="rounded-lg bg-green-600 px-8 py-3 text-lg font-bold text-white hover:bg-green-700 transition-colors"
          >
            Start Game!
          </button>
        )}
      </div>
    );
  }

  if (!state.currentRound) {
    return (
      <div className="flex items-center justify-center pt-24">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-700 border-t-brand-500" />
      </div>
    );
  }

  const { currentRound, roundResult, selectedAnswer } = state;
  const showResult = roundResult !== null;

  const getOptionState = (login: string) => {
    if (!showResult) {
      return selectedAnswer === login ? "selected" : "default";
    }
    if (login === roundResult.correctLogin) return "correct";
    if (selectedAnswer === login) return "wrong";
    return "default";
  };

  const isCorrect = showResult && selectedAnswer === roundResult.correctLogin;

  const handleAnswer = (login: string) => {
    if (selectedAnswer || showResult) return;
    dispatch({ type: "SELECT_ANSWER", login });
    sendMessage({
      type: "round:answer",
      payload: { contributorLogin: login },
    });
  };

  return (
    <div className="space-y-6">
      {isCorrect && <ConfettiEffect />}

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">
          Round {currentRound.roundIndex + 1}/{ROUNDS_COUNT}
        </span>
        <Timer duration={ROUND_TIME_MS} remaining={state.timeRemaining} />
      </div>

      <SnippetDisplay
        code={currentRound.snippet}
        language={currentRound.language}
      />

      <div className="space-y-3">
        <p className="text-center text-sm font-medium text-gray-400">
          Who wrote this code?
        </p>
        {currentRound.options.map((opt) => (
          <AnswerOption
            key={opt.login}
            contributor={opt}
            state={getOptionState(opt.login) as "default" | "selected" | "correct" | "wrong"}
            onClick={() => handleAnswer(opt.login)}
          />
        ))}
      </div>

      {showResult && (
        <div
          className={`rounded-lg border-2 p-4 text-center animate-fade-in ${
            isCorrect
              ? "border-green-500 bg-green-500/10 text-green-400"
              : "border-red-500 bg-red-500/10 text-red-400"
          }`}
        >
          <span className="text-3xl">{isCorrect ? "✓" : "✗"}</span>
          <p className="mt-1 text-lg font-bold">
            {isCorrect ? "Correct!" : "Wrong!"}
          </p>
        </div>
      )}
    </div>
  );
}
