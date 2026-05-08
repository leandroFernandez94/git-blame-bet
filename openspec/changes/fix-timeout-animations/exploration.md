# Exploration: fix-timeout-animations

## Current State

### Backend Round Timeout Handling

**File**: `backend/src/game/engine.ts`

When a round starts (`startNextRound`, lines 145-185), the engine:
1. Creates a `setTimeout` for `ROUND_TIME_MS` (30 seconds)
2. Creates a `setInterval` that broadcasts `round:tick` every second
3. When the timeout fires, calls `endRound(gameId)` (line 181)

**Key finding**: The backend correctly identifies players who timed out via `calculateRoundScores` (line 210). In the `PlayerScore` type, there's already a `timedOut` field that tracks this.

The `round:result` message (lines 228-235) includes `PlayerScore[]` with each player's `wrong` and `timedOut` counts. The backend DOES track timeouts correctly.

### Backend Answer Processing

**File**: `backend/src/game/state.ts`

The `calculateRoundScores` function (lines 158-181) processes ALL players, including those who didn't submit an answer:
- Line 174: `const answer = round.answers.get(nickname);`
- Line 175: `const correct = answer === round.correctLogin;` — for players who didn't answer, `answer` is `undefined`, so `correct` is always `false`
- Line 176: Only increment score if `correct`
- Line 177: Push `{ nickname, correct }` to results

The backend correctly treats no-answer as wrong.

### WebSocket Messages

**File**: `packages/shared/src/types/messages.ts`

The `RoundResultMessage` (lines 74-81) contains:
```typescript
type RoundResultMessage = {
  type: "round:result";
  payload: {
    correctLogin: string;
    scores: PlayerScore[];
    roundIndex: number;
  };
};
```

`PlayerScore` (from `types/game.ts`, lines 51-57):
```typescript
type PlayerScore = {
  nickname: string;
  score: number;
  correct: number;
  wrong: number;
  timedOut: number;
};
```

The message already supports per-player timeout data.

### Frontend Round Feedback

**File**: `frontend/src/pages/PlayingPage.tsx`

**THE BUG**: Lines 68-75 (`getOptionState` function):
```typescript
const getOptionState = (login: string) => {
  if (!showResult) {
    return selectedAnswer === login ? "selected" : "default";
  }
  if (login === roundResult.correctLogin) return "correct";
  if (selectedAnswer === login) return "wrong";
  return "default";
};
```

**Root Cause**: The frontend only shows "wrong" when:
- `selectedAnswer === login` (user selected this option AND it's wrong)

For a timeout:
- `selectedAnswer` is `null` (never set)
- So `selectedAnswer === login` is never true for ANY option
- Therefore no option gets the "wrong" state
- No error feedback is shown

### Timer Component

**File**: `frontend/src/components/Timer.tsx`

The Timer is a passive display component. It receives `duration` and `remaining` props and renders an SVG circle. No events are emitted on timeout — that's handled by the backend `round:result` message.

### GameContext

**File**: `frontend/src/context/GameContext.tsx`

The reducer handles `round:result` (line 123-124):
```typescript
case "round:result":
  return { ...state, roundResult: msg.payload };
```

This stores the result with scores but the frontend UI in `PlayingPage` doesn't use the per-player score data.

## Root Cause

**Location**: `frontend/src/pages/PlayingPage.tsx`, lines 68-75

The frontend doesn't differentiate between:
1. Player answered wrong (`selectedAnswer` is set to wrong answer)
2. Player timed out (`selectedAnswer` is `null`)

Both cases result in no visual feedback. The `roundResult.scores` array contains `timedOut` counts per player, but the frontend doesn't use this data to show feedback.

## Affected Areas

| File | Issue |
|------|-------|
| `frontend/src/pages/PlayingPage.tsx` | Does not show error feedback for timeouts |
| `frontend/src/context/GameContext.tsx` | Doesn't track if the local player timed out (optional) |
| `packages/shared/src/types/game.ts` | `PlayerScore` already has `timedOut` field (no change needed) |

## Edge Cases

1. **All players timeout**: All players have `selectedAnswer = null`. All options show as "default", but the result banner shows "Wrong!" because no one was correct.

2. **Mixed scenario (some answer, some timeout)**: Players who answered wrong get "wrong" state. Players who timed out get no feedback (bug).

3. **Last moment answer before timeout**: If a player answers just before timeout, `selectedAnswer` is set. The feedback logic works correctly.

4. **Double submission race**: The backend uses `roundEnded` Set (line 201) to prevent double-ending, so this is handled.

## Recommended Fix

Modify `PlayingPage.tsx` to detect when the local player timed out and show appropriate feedback:

```typescript
// In getOptionState, add timeout detection:
// Check if local player is in roundResult.scores with timedOut > 0
```

Or alternatively, add a `timedOut: boolean` field to the local player's state when processing `round:result`.

## Files to Change

1. **`frontend/src/pages/PlayingPage.tsx`** — Main fix: show "Wrong!" feedback when player timed out
2. **`frontend/src/context/GameContext.tsx`** — Optional: track timeout state for cleaner UI

## Effort Estimate

- **Low complexity**: The backend already tracks timeout correctly. Only frontend UI changes needed.
- The `roundResult.scores` array tells us which players timed out. Need to compare with `state.nickname` to detect if the local player timed out.