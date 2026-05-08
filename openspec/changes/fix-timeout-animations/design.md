# Design: fix-timeout-animations

## Technical Approach

Detect the local player's timeout by scanning `roundResult.scores` for an entry matching `state.nickname` with `timedOut > 0`. Extend `getOptionState` to mark all non-correct options as "wrong" when the player timed out. Update the result banner to show "Time's up!" instead of "Wrong!" for timeouts. Single-file change — no backend or shared types modifications needed.

## Architecture Decisions

### Decision: Detect timeout from scores array

**Choice**: Check `roundResult.scores` for the local player's timeout entry
**Alternatives considered**: Add a `timedOut: boolean` field to GameState via the reducer
**Rationale**: Avoids state inflation. The timeout data already exists in `roundResult.scores` — no need to duplicate it into GameState. Derived state in the component keeps logic localized.

### Decision: "wrong" state for all options on timeout

**Choice**: `localTimedOut ? "wrong" : "default"` for non-correct options
**Alternatives considered**: Create a new `"timed-out"` state variant on AnswerOption
**Rationale**: Visually consistent with wrong-answer feedback. AnswerOption already renders "wrong" identically for both cases — no component changes needed.

## Data Flow

```
round:result message
       │
       ▼
GameContext stores roundResult.scores[]
       │
       ▼
PlayingPage derives localTimedOut from scores
       │
       ├──→ getOptionState returns "wrong" for all non-correct options
       │
       └──→ Result banner shows "Time's up!" + "✗" icon
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/pages/PlayingPage.tsx` | Modify | Detect local timeout, update feedback logic and banner |

## Interfaces / Contracts

**Type changes**: None — `PlayerScore.timedOut` already exists.

**Derived state pattern** (inside `PlayingPage.tsx`):

```typescript
const localTimedOut = roundResult.scores.some(
  s => s.nickname === state.nickname && s.timedOut > 0
);

const getOptionState = (login: string) => {
  if (!showResult) {
    return selectedAnswer === login ? "selected" : "default";
  }
  if (login === roundResult.correctLogin) return "correct";
  if (localTimedOut) return "wrong";  // ← NEW: all wrong on timeout
  if (selectedAnswer === login) return "wrong";
  return "default";
};

const resultMessage = localTimedOut ? "Time's up!" : (isCorrect ? "Correct!" : "Wrong!");
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `localTimedOut` detection | Test `.some()` logic with mock scores arrays |
| Unit | `getOptionState` with timeout | Verify "wrong" for all non-correct, "correct" for right answer |
| Unit | Result banner text | Verify "Time's up!" vs "Correct!" vs "Wrong!" |
| Integration | Full round flow | E2E: join game, wait for timeout, verify visual feedback |
| Edge case | All players timeout | Verify each player sees "Time's up!" banner |

## Migration / Rollout

No migration required. The change is purely additive — removing the timeout detection logic reverts to current behavior (no feedback on timeout).

## Open Questions

None.
