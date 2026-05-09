import { ROUND_TIME_MS, type Contributor, type Round } from "@git-blame-bet/shared";

const CONTRIBUTORS: Contributor[] = [
  {
    displayName: "alice-dev",
    avatarUrl: "https://example.com/alice.png",
    commitsCount: 32,
  },
  {
    displayName: "bob-dev",
    avatarUrl: "https://example.com/bob.png",
    commitsCount: 21,
  },
  {
    displayName: "carol-dev",
    avatarUrl: "https://example.com/carol.png",
    commitsCount: 16,
  },
];

export function getStandardRepoContributors(): Contributor[] {
  return CONTRIBUTORS.map((contributor) => ({ ...contributor }));
}

function buildRound(params: {
  index: number;
  snippet: string;
  language: string;
  filePath: string;
  startLine: number;
  correctLogin: string;
  options: Contributor[];
}): Round {
  return {
    ...params,
    answers: new Map(),
    startedAt: null,
    completedAt: null,
    timeLimit: ROUND_TIME_MS,
  };
}

export function getStandardRepoRounds(): Round[] {
  return [
    buildRound({
      index: 0,
      snippet: "export function sum(a: number, b: number) {\n  return a + b;\n}",
      language: "typescript",
      filePath: "src/math/sum.ts",
      startLine: 1,
      correctLogin: "alice-dev",
      options: [CONTRIBUTORS[0], CONTRIBUTORS[1], CONTRIBUTORS[2]],
    }),
    buildRound({
      index: 1,
      snippet:
        "export function toSlug(value: string) {\n  return value.trim().toLowerCase().replace(/\\s+/g, '-');\n}",
      language: "typescript",
      filePath: "src/strings/to-slug.ts",
      startLine: 1,
      correctLogin: "bob-dev",
      options: [CONTRIBUTORS[1], CONTRIBUTORS[0], CONTRIBUTORS[2]],
    }),
    buildRound({
      index: 2,
      snippet:
        "export function groupBy<T>(items: T[], key: (item: T) => string) {\n  return items.reduce<Record<string, T[]>>((acc, item) => {\n    const group = key(item);\n    acc[group] ??= [];\n    acc[group].push(item);\n    return acc;\n  }, {});\n}",
      language: "typescript",
      filePath: "src/collections/group-by.ts",
      startLine: 1,
      correctLogin: "carol-dev",
      options: [CONTRIBUTORS[2], CONTRIBUTORS[0], CONTRIBUTORS[1]],
    }),
    buildRound({
      index: 3,
      snippet:
        "export function clamp(value: number, min: number, max: number) {\n  return Math.min(max, Math.max(min, value));\n}",
      language: "typescript",
      filePath: "src/math/clamp.ts",
      startLine: 1,
      correctLogin: "alice-dev",
      options: [CONTRIBUTORS[0], CONTRIBUTORS[2], CONTRIBUTORS[1]],
    }),
    buildRound({
      index: 4,
      snippet:
        "export function unique<T>(items: T[]) {\n  return [...new Set(items)];\n}",
      language: "typescript",
      filePath: "src/collections/unique.ts",
      startLine: 1,
      correctLogin: "bob-dev",
      options: [CONTRIBUTORS[1], CONTRIBUTORS[0], CONTRIBUTORS[2]],
    }),
  ];
}
