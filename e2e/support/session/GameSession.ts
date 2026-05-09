import type { Browser, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Player } from "./Player";

export type FixtureId = "standard-repo";

export class GameSession {
  private readonly backendOrigin: string;

  readonly playerA: Player;
  readonly playerB: Player;

  constructor({
    playerANickname,
    playerBNickname,
    backendOrigin,
  }: {
    playerANickname: string;
    playerBNickname: string;
    backendOrigin: string;
  }) {
    this.playerA = new Player(playerANickname);
    this.playerB = new Player(playerBNickname);
    this.backendOrigin = backendOrigin;
  }

  async launch(browser: Browser): Promise<void> {
    await Promise.all([
      this.playerA.launch(browser, this.backendOrigin),
      this.playerB.launch(browser, this.backendOrigin),
    ]);
  }

  async setFixture(fixtureId: FixtureId): Promise<void> {
    await Promise.all([
      this.playerA.setFixture(fixtureId),
      this.playerB.setFixture(fixtureId),
    ]);
  }

  async createGame(repoUrl: string): Promise<string> {
    const page = this.playerA.getPage();
    const fixtureId = this.playerA.getFixtureId();

    await page.goto(fixtureId ? `/?fixture=${fixtureId}` : "/");
    await page.getByTestId("home-nickname-input").fill(this.playerA.nickname);
    await page.getByTestId("home-repo-url-input").fill(repoUrl);
    await page.getByTestId("home-create-game").click();

    await expect(page).toHaveURL(/\/game\//);

    const url = new URL(page.url());
    const gameId = url.pathname.split("/").pop();
    if (!gameId) {
      throw new Error("Unable to resolve game ID after creating game");
    }

    return gameId;
  }

  async joinGame(gameId: string): Promise<void> {
    const page = this.playerB.getPage();
    await page.goto(`/play/${gameId}`);
    await page.getByTestId("join-nickname-input").fill(this.playerB.nickname);
    await page.getByTestId("join-submit").click();
    await expect(page.getByText("Waiting for game to start...")).toBeVisible();
    await expect(this.playerA.getPage().getByText(this.playerB.nickname)).toBeVisible();
  }

  async startGameFromLobby(): Promise<void> {
    const playerAPage = this.playerA.getPage();
    const playerBPage = this.playerB.getPage();

    await playerAPage.getByTestId("lobby-start-game").click();
    await Promise.all([
      expect(playerAPage).toHaveURL(/\/playing\//),
      expect(playerBPage).toHaveURL(/\/playing\//),
    ]);

    const readyState = playerAPage.getByRole("heading", { name: "Game Ready!" });
    if (await readyState.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await playerAPage.getByTestId("playing-start-game").click();
    }
  }

  async waitForRoundToStart(): Promise<void> {
    await this.waitForRound(1);
  }

  async waitForRound(roundNumber: number): Promise<void> {
    await Promise.all([
      this.expectRoundVisible(this.playerA.getPage(), roundNumber),
      this.expectRoundVisible(this.playerB.getPage(), roundNumber),
    ]);
  }

  async answerRoundDeterministically(correctLogin: string): Promise<void> {
    const wrongLogin = correctLogin === "alice-dev" ? "bob-dev" : "alice-dev";

    await Promise.all([
      this.playerA
        .getPage()
        .getByRole("button", { name: correctLogin })
        .click(),
      this.playerB
        .getPage()
        .getByRole("button", { name: wrongLogin })
        .click(),
    ]);

    await Promise.all([
      expect(this.playerA.getPage().getByTestId("playing-round-feedback")).toBeVisible(),
      expect(this.playerB.getPage().getByTestId("playing-round-feedback")).toBeVisible(),
    ]);
  }

  async playFixtureGameDeterministically(): Promise<void> {
    const correctLogins = [
      "alice-dev",
      "bob-dev",
      "carol-dev",
      "alice-dev",
      "bob-dev",
    ];

    for (const [index, correctLogin] of correctLogins.entries()) {
      await this.waitForRound(index + 1);
      await this.answerRoundDeterministically(correctLogin);

      if (index < correctLogins.length - 1) {
        await this.waitForRound(index + 2);
      }
    }
  }

  async expectResultsReady(): Promise<void> {
    await Promise.all([
      this.expectResultsVisible(this.playerA.getPage()),
      this.expectResultsVisible(this.playerB.getPage()),
    ]);
  }

  async expectWinner(nickname: string): Promise<void> {
    await Promise.all([
      expect(
        this.playerA
          .getPage()
          .getByTestId("results-podium-first")
          .locator("..")
          .getByText(nickname),
      ).toBeVisible(),
      expect(
        this.playerB
          .getPage()
          .getByTestId("results-podium-first")
          .locator("..")
          .getByText(nickname),
      ).toBeVisible(),
    ]);
  }

  async expectPodiumAnchorVisible(): Promise<void> {
    await Promise.all([
      expect(this.playerA.getPage().getByTestId("results-podium-first")).toBeVisible(),
      expect(this.playerB.getPage().getByTestId("results-podium-first")).toBeVisible(),
    ]);
  }

  async dispose(): Promise<void> {
    await Promise.all([this.playerA.dispose(), this.playerB.dispose()]);
  }

  private async expectRoundVisible(page: Page, roundNumber: number): Promise<void> {
    await expect(page.getByText(`Round ${roundNumber}/20`)).toBeVisible();
    await expect(page.getByText("Who wrote this code?")).toBeVisible();
  }

  private async expectResultsVisible(page: Page): Promise<void> {
    await expect(page.getByText("Game Over!")).toBeVisible();
    await expect(page.getByTestId("results-podium-first")).toBeVisible();
  }
}
