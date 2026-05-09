Feature: Full game baseline from issue #20

  Scenario: Two players complete full deterministic game and reach stable results
    Given fixture "standard-repo" is configured for both players
    When "Leandro" creates a game using repository "https://github.com/example/standard-repo"
    And "Maria" joins the created game
    And "Leandro" starts the game
    Then both players should reach the first round
    When players complete deterministic fixture rounds
    Then both players should eventually see the final results
    And results UI should expose deterministic podium anchor
    And "Leandro" should win with deterministic fixture outcome
