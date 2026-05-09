import { beforeEach, describe, expect, it } from "vitest";
import { parseFixtureId, resolveFixtureId } from "./fixture-context";

describe("fixture-context", () => {
  beforeEach(() => {
    delete process.env.E2E_FIXTURE_ROUTING;
  });

  it("keeps fixture routing disabled by default", () => {
    expect(parseFixtureId("standard-repo")).toBeUndefined();
    expect(
      resolveFixtureId({ payloadFixtureId: "standard-repo" }),
    ).toBeUndefined();
  });

  it("parses known fixture only when routing is enabled", () => {
    process.env.E2E_FIXTURE_ROUTING = "1";
    expect(parseFixtureId("standard-repo")).toBe("standard-repo");
    expect(parseFixtureId("unknown-fixture")).toBeUndefined();
    expect(parseFixtureId(undefined)).toBeUndefined();
  });

  it("resolves precedence payload > handshake > none", () => {
    process.env.E2E_FIXTURE_ROUTING = "true";

    expect(
      resolveFixtureId({
        payloadFixtureId: "standard-repo",
        handshakeFixtureId: undefined,
      }),
    ).toBe("standard-repo");

    expect(
      resolveFixtureId({
        payloadFixtureId: undefined,
        handshakeFixtureId: "standard-repo",
      }),
    ).toBe("standard-repo");

    expect(
      resolveFixtureId({
        payloadFixtureId: undefined,
        handshakeFixtureId: undefined,
      }),
    ).toBeUndefined();
  });
});
