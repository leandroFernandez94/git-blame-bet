import type { Browser, BrowserContext, Page } from "@playwright/test";
import { attachFixtureRoute, type FixtureId } from "../fixtures/fixture-route";

export class Player {
  readonly nickname: string;
  private backendOrigin: string | null = null;

  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private fixtureId: FixtureId | undefined;

  constructor(nickname: string) {
    this.nickname = nickname;
  }

  async launch(browser: Browser, backendOrigin: string): Promise<void> {
    this.backendOrigin = backendOrigin;
    this.context = await browser.newContext();
    if (this.fixtureId) {
      await attachFixtureRoute({
        context: this.context,
        fixtureId: this.fixtureId,
        backendOrigin,
      });
    }
    this.page = await this.context.newPage();
  }

  async setFixture(fixtureId: FixtureId): Promise<void> {
    this.fixtureId = fixtureId;

    if (this.context && this.backendOrigin) {
      await attachFixtureRoute({
        context: this.context,
        fixtureId,
        backendOrigin: this.backendOrigin,
      });
    }
  }

  getFixtureId(): FixtureId | undefined {
    return this.fixtureId;
  }

  getPage(): Page {
    if (!this.page) {
      throw new Error(`Player ${this.nickname} is not launched yet`);
    }
    return this.page;
  }

  async dispose(): Promise<void> {
    await this.context?.close();
    this.context = null;
    this.page = null;
    this.backendOrigin = null;
  }
}
