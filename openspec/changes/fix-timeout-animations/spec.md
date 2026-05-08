# Delta for round-answer-feedback

## MODIFIED Requirements

### Requirement: Option Feedback on Result Display

When round results are displayed, the system SHALL display the correct answer and provide feedback for the local player's selection.

The system MUST show the correct option with "correct" state (green highlight).

When the local player timed out (no answer submitted before time expired), the system SHALL display "wrong" feedback for all non-correct options.

#### Scenario: Player answered correctly

- GIVEN player selected the correct answer before timeout
- WHEN `showResult` is `true` and `selectedAnswer === correctLogin`
- THEN the selected option displays "correct" state
- AND non-selected options display "default" state

#### Scenario: Player answered incorrectly

- GIVEN player selected a wrong answer before timeout
- WHEN `showResult` is `true` and `selectedAnswer !== correctLogin`
- THEN the selected option displays "wrong" state (red highlight)
- AND the correct option displays "correct" state

#### Scenario: Player timed out (no answer)

- GIVEN player did not submit any answer before timeout
- WHEN `showResult` is `true` and local player `timedOut > 0` in `roundResult.scores`
- THEN ALL non-correct options display "wrong" state
- AND the correct option displays "correct" state

#### Scenario: Player answered before timeout but incorrectly (no regression)

- GIVEN player selected wrong answer before timeout
- WHEN `showResult` is `true` and `selectedAnswer !== correctLogin`
- THEN behavior remains unchanged from current implementation
- AND correct option displays "correct" state

### Requirement: Timeout Result Banner Text

The system SHALL clearly indicate to the player when time has expired.

When displaying round result feedback, if the local player timed out, the banner text SHALL indicate timeout (e.g., "Time's up!") rather than generic wrong feedback.

#### Scenario: Player timed out banner

- GIVEN player did not submit any answer before timeout
- WHEN round result banner is displayed
- THEN banner text indicates "Time's up!" or equivalent timeout message
- AND the visual feedback for options reflects timeout state (all wrong)

#### Scenario: Player answered wrong banner

- GIVEN player selected a wrong answer before timeout
- WHEN round result banner is displayed
- THEN banner text indicates "Wrong!" or equivalent message
- AND visual feedback applies only to selected wrong answer

## Test Scenarios

| Scenario | Precondition | Action | Expected Outcome |
|----------|-------------|--------|------------------|
| Timeout feedback | Player times out | Show result | All non-correct options show "wrong" state |
| Correct option on timeout | Player times out | Show result | Correct option still shows green "correct" state |
| Mixed: some wrong, some timeout | Some players answer wrong, some time out | Show result | Each player sees appropriate feedback for their own state |
| Answer before timeout (regression) | Player answered incorrectly | Show result | Wrong answer highlighted red, correct highlighted green |
| Correct answer before timeout | Player answered correctly | Show result | Selected option shows green "correct" state |
| All players timeout | No player answers | Show result | All options show "wrong" state except correct |
