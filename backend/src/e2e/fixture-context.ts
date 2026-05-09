import type { MockFixtureId } from "@git-blame-bet/shared";
import { isFixtureRoutingEnabled } from "./fixture-gating";

const ALLOWED_FIXTURES = new Set<MockFixtureId>(["standard-repo"]);

export function parseFixtureId(
  value: string | null | undefined,
): MockFixtureId | undefined {
  if (!value || !isFixtureRoutingEnabled()) return undefined;
  return ALLOWED_FIXTURES.has(value as MockFixtureId)
    ? (value as MockFixtureId)
    : undefined;
}

export function resolveFixtureId({
  payloadFixtureId,
  handshakeFixtureId,
}: {
  payloadFixtureId?: MockFixtureId;
  handshakeFixtureId?: MockFixtureId;
}): MockFixtureId | undefined {
  if (!isFixtureRoutingEnabled()) return undefined;
  return payloadFixtureId ?? handshakeFixtureId;
}
