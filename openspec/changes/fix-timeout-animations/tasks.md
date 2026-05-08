# Tasks: fix-timeout-animations

## Phase 1: Timeout Detection (Foundation)

- [ ] 1.1 Add derived `localTimedOut` state in `PlayingPage.tsx` — scan `roundResult.scores` for entry matching `state.nickname` with `timedOut > 0`

## Phase 2: Option Feedback Logic (Core)

- [ ] 2.1 Modify `getOptionState` function in `PlayingPage.tsx` — return "wrong" for all non-correct options when `localTimedOut` is true
- [ ] 2.2 Verify correct option still returns "correct" state regardless of timeout

## Phase 3: Result Banner Update (Core)

- [ ] 3.1 Update result banner message — show "Time's up!" when `localTimedOut` is true, preserve "Correct!" / "Wrong!" for answered scenarios

## Phase 4: Testing

- [ ] 4.1 Write unit test for `localTimedOut` detection with mock scores arrays (timeout entry, non-timeout entry, no matching entry)
- [ ] 4.2 Write unit test for `getOptionState` with timeout — verify "wrong" for all non-correct, "correct" for answer
- [ ] 4.3 Write unit test for result banner text — verify "Time's up!" vs "Correct!" vs "Wrong!" messages

## Phase 5: Verification

- [ ] 5.1 Run existing tests to ensure no regression
- [ ] 5.2 Manual verification: join game, wait for timeout, verify visual feedback matches spec scenarios