import type { Contributor, Round } from "@git-blame-bet/shared";
import { ROUNDS_COUNT, ROUND_TIME_MS, MIN_CONTRIBUTORS } from "@git-blame-bet/shared";
import {
  parseRepoUrl,
  validateRepo,
  getContributors,
  cloneRepo,
} from "../github/client";
import { extractSnippets } from "./snippet-extractor";
import { buildEmailMap } from "../utils/git-blame";
import { scheduleTempCleanup } from "../utils/cleanup";

export type RepoProcessResult = {
  rounds: Round[];
  contributors: Contributor[];
  repoPath: string;
};

function pickDistractors(
  correctLogin: string,
  allContributors: Contributor[],
  count: number,
): Contributor[] {
  const others = allContributors.filter((c) => c.login !== correctLogin);
  const shuffled = others.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export async function processRepo(
  repoUrl: string,
  pathFilter?: string,
  onProgress?: (step: string, progress: number) => void,
): Promise<RepoProcessResult> {
  const totalStart = performance.now();
  const { owner, repo } = parseRepoUrl(repoUrl);
  console.log(`[repo] Processing ${owner}/${repo}${pathFilter ? ` (filter: "${pathFilter}")` : ""}`);

  onProgress?.("Validating repository...", 0.1);
  const valStart = performance.now();
  await validateRepo(owner, repo);
  console.log(`[repo] Validated in ${((performance.now() - valStart) / 1000).toFixed(1)}s`);

  onProgress?.("Fetching contributors...", 0.2);
  const contribStart = performance.now();
  const contributors = await getContributors(owner, repo);
  console.log(`[repo] Got ${contributors.length} contributors in ${((performance.now() - contribStart) / 1000).toFixed(1)}s`);

  if (contributors.length < MIN_CONTRIBUTORS) {
    throw new Error(
      `Repository needs at least ${MIN_CONTRIBUTORS} contributors for a game`,
    );
  }

  onProgress?.("Cloning repository...", 0.3);
  const repoPath = await cloneRepo(repoUrl);

  onProgress?.("Building email map...", 0.4);
  const emailMapStart = performance.now();
  const emailMap = await buildEmailMap(repoPath, contributors);
  console.log(`[repo] Email map built in ${((performance.now() - emailMapStart) / 1000).toFixed(1)}s`);

  onProgress?.("Extracting code snippets...", 0.5);
  const extractStart = performance.now();
  const snippets = await extractSnippets(repoPath, pathFilter, ROUNDS_COUNT, contributors, emailMap);
  console.log(`[repo] Snippet extraction total: ${snippets.length} snippets in ${((performance.now() - extractStart) / 1000).toFixed(1)}s`);

  if (snippets.length < 5) {
    scheduleTempCleanup(repoPath);
    throw new Error(
      "Not enough TypeScript code snippets found. Try a different repository or filter.",
    );
  }

  onProgress?.("Building game rounds...", 0.8);

  const rounds: Round[] = snippets.map((snippet, i) => {
    const correctContributor = contributors.find(
      (c) => c.login === snippet.blame.login,
    ) ?? {
      login: snippet.blame.login,
      avatarUrl: `https://github.com/${snippet.blame.login}.png`,
      commitsCount: 0,
    };

    const distractors = pickDistractors(snippet.blame.login, contributors, 2);
    const options = [correctContributor, ...distractors].sort(
      () => Math.random() - 0.5,
    );

    return {
      index: i,
      snippet: snippet.code,
      language: snippet.language,
      filePath: snippet.filePath,
      startLine: snippet.startLine,
      correctLogin: snippet.blame.login,
      options,
      answers: new Map(),
      startedAt: null,
      completedAt: null,
      timeLimit: ROUND_TIME_MS,
    };
  });

  onProgress?.("Ready!", 1.0);
  console.log(`[repo] Pipeline complete: ${rounds.length} rounds built in ${((performance.now() - totalStart) / 1000).toFixed(1)}s total`);

  scheduleTempCleanup(repoPath, 300_000);

  return { rounds, contributors, repoPath };
}
