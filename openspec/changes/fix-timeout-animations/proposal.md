# Proposal: fix-timeout-animations

## Intent

When a round ends due to timeout, the frontend fails to show any visual feedback to the player. Currently, the "wrong" state only applies when a player actively selected a wrong answer. On timeout, `selectedAnswer` is `null`, so no option receives feedback — leaving the player confused.

## Scope

### In Scope
- Detect timeout state for the local player from `roundResult.scores`
- Show "wrong" feedback for all options when player times out
- Display a timeout indicator (e.g., "Time's up!") in the result banner

### Out of Scope
- Backend changes (already tracks timeouts correctly)
- Changes to `PlayerScore` type (already has `timedOut` field)
- Audio/visual timeout effects beyond feedback state

## Capabilities

### Modified Capabilities
- `round-answer-feedback`: Timeout will now trigger the same feedback flow as a wrong answer (all options show "wrong" state)

## Approach

1. **Detect local player's timeout**: In `PlayingPage.tsx`, after receiving `round:result`, check if the local player appears in `roundResult.scores` with `timedOut > 0`

2. **Extend `getOptionState`**: Add timeout detection to return "wrong" state when local player timed out:
   ```typescript
   const localTimedOut = roundResult.scores.find(
     s => s.nickname === state.nickname && s.timedOut > 0
   );
   
   if (localTimedOut) {
     return login === roundResult.correctLogin ? "correct" : "wrong";
   }
   ```

3. **Add timeout banner**: Optionally show "Time's up!" in the result feedback banner

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/pages/PlayingPage.tsx` | Modified | Detect timeout, update `getOptionState` logic |
| `frontend/src/context/GameContext.tsx` | Optional | May add `timedOut` flag to state for cleaner banner text |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Race condition: answer + timeout simultaneously | Low | Backend prevents double-end via `roundEnded` Set |
| Player nickname mismatch | Low | Null-check before comparing |

## Rollback Plan

Revert changes to `PlayingPage.tsx`. The timeout detection logic is additive — removing it returns to current behavior where timeout = no feedback.

## Dependencies

- Backend `round:result` message includes `PlayerScore[]` with `timedOut` field (already exists)
- `PlayerScore` type in `packages/shared/src/types/game.ts` (unchanged)

## Success Criteria

- [ ] Timeout triggers "wrong" state for all non-correct options
- [ ] Correct option still highlights green
- [ ] Mixed scenario (some wrong, some timeout) works correctly
- [ ] No regression for players who answer before timeout
