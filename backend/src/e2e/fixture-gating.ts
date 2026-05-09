export function isFixtureRoutingEnabled(): boolean {
  const value = process.env.E2E_FIXTURE_ROUTING;
  return value === "1" || value === "true";
}
