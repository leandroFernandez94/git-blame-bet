import type { BrowserContext, Route } from "@playwright/test";

export type FixtureId = "standard-repo";

function shouldInjectHeader(url: string, backendOrigin: string): boolean {
  return (
    url.startsWith(`${backendOrigin}/api/`) ||
    url.startsWith(`${backendOrigin}/ws`) ||
    url.startsWith("http://localhost:3000/api/") ||
    url.startsWith("http://localhost:3000/ws")
  );
}

export async function attachFixtureRoute({
  context,
  fixtureId,
  backendOrigin,
}: {
  context: BrowserContext;
  fixtureId: FixtureId;
  backendOrigin: string;
}): Promise<void> {
  await context.route("**/*", async (route: Route) => {
    const request = route.request();
    if (!shouldInjectHeader(request.url(), backendOrigin)) {
      await route.continue();
      return;
    }

    await route.continue({
      headers: {
        ...request.headers(),
        "X-Mock-Fixture": fixtureId,
      },
    });
  });
}
