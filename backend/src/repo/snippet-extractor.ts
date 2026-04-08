import { Project, SyntaxKind, type SourceFile, type Node } from "ts-morph";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { SnippetType, SNIPPET_MIN_LINES, SNIPPET_MAX_LINES } from "@git-blame-bet/shared";
import type { Snippet, BlameInfo, Contributor } from "@git-blame-bet/shared";
import { getBlameForLines, type EmailMap } from "../utils/git-blame";

type RawSnippet = {
  code: string;
  filePath: string;
  startLine: number;
  endLine: number;
  type: SnippetType;
  name: string;
};

const EXTRACTABLE_KINDS = new Map<SyntaxKind, SnippetType>([
  [SyntaxKind.FunctionDeclaration, SnippetType.Function],
  [SyntaxKind.ArrowFunction, SnippetType.Function],
  [SyntaxKind.MethodDeclaration, SnippetType.Method],
  [SyntaxKind.ClassDeclaration, SnippetType.Class],
  [SyntaxKind.VariableStatement, SnippetType.VariableDeclaration],
  [SyntaxKind.IfStatement, SnippetType.Block],
  [SyntaxKind.ForStatement, SnippetType.Block],
  [SyntaxKind.ForOfStatement, SnippetType.Block],
  [SyntaxKind.ForInStatement, SnippetType.Block],
  [SyntaxKind.WhileStatement, SnippetType.Block],
  [SyntaxKind.SwitchStatement, SnippetType.Block],
]);

function getNodeName(node: Node): string {
  if ("getName" in node && typeof (node as any).getName === "function") {
    return (node as any).getName() ?? "anonymous";
  }
  return node.getKindName();
}

function collectTsFiles(
  dir: string,
  pathFilter?: string,
  maxDepth = 10,
  depth = 0,
): string[] {
  if (depth > maxDepth) return [];
  const files: string[] = [];

  try {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === ".git" || entry === "dist")
        continue;
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        files.push(...collectTsFiles(full, pathFilter, maxDepth, depth + 1));
      } else if (/\.tsx?$/.test(entry) && !entry.endsWith(".d.ts")) {
        if (!pathFilter || full.includes(pathFilter)) {
          files.push(full);
        }
      }
    }
  } catch {}

  return files;
}

function extractFromFile(sourceFile: SourceFile, filePath: string): RawSnippet[] {
  const snippets: RawSnippet[] = [];

  sourceFile.forEachDescendant((node) => {
    const snippetType = EXTRACTABLE_KINDS.get(node.getKind());
    if (!snippetType) return;

    const startLine = node.getStartLineNumber();
    const endLine = node.getEndLineNumber();
    const lineCount = endLine - startLine + 1;

    if (lineCount < SNIPPET_MIN_LINES || lineCount > SNIPPET_MAX_LINES) return;

    const code = node.getText();
    if (code.trim().length < 20) return;

    snippets.push({
      code,
      filePath,
      startLine,
      endLine,
      type: snippetType,
      name: getNodeName(node),
    });
  });

  return snippets;
}

const OVERSAMPLE_FACTOR = 5;

export async function extractSnippets(
  repoPath: string,
  pathFilter?: string,
  count = 20,
  contributors: Contributor[] = [],
  emailMap?: EmailMap,
): Promise<Snippet[]> {
  const collectStart = performance.now();
  const tsFiles = collectTsFiles(repoPath, pathFilter);
  console.log(`[snippets] Found ${tsFiles.length} .ts/.tsx files (${((performance.now() - collectStart) / 1000).toFixed(1)}s)${pathFilter ? ` filter="${pathFilter}"` : ""}`);
  if (tsFiles.length === 0) return [];

  const project = new Project({ useInMemoryFileSystem: false });
  const rawSnippets: RawSnippet[] = [];

  const parseStart = performance.now();
  let parsed = 0;
  let failed = 0;
  for (const file of tsFiles) {
    try {
      const content = readFileSync(file, "utf-8");
      const relativePath = file.replace(repoPath + "/", "");
      const sourceFile = project.createSourceFile(
        `virtual/${relativePath}`,
        content,
      );
      rawSnippets.push(...extractFromFile(sourceFile, relativePath));
      parsed++;
      if (parsed % 100 === 0) {
        console.log(`[snippets] Parsed ${parsed}/${tsFiles.length} files, ${rawSnippets.length} raw snippets so far...`);
      }
    } catch {
      failed++;
    }
  }
  console.log(`[snippets] AST parsing done: ${parsed} parsed, ${failed} failed, ${rawSnippets.length} raw snippets (${((performance.now() - parseStart) / 1000).toFixed(1)}s)`);

  const shuffled = rawSnippets.sort(() => Math.random() - 0.5);
  const candidateCount = Math.min(count * OVERSAMPLE_FACTOR, shuffled.length);
  const selected = shuffled.slice(0, candidateCount);
  console.log(`[snippets] Selected ${selected.length} candidates for blame attribution`);

  const snippets: Snippet[] = [];
  const blameStart = performance.now();
  let blameCount = 0;
  let blameSkipped = 0;
  const unmatchedEmails = new Set<string>();
  for (const raw of selected) {
    if (snippets.length >= count) break;

    blameCount++;
    const blame = await getBlameForLines(
      repoPath,
      raw.filePath,
      raw.startLine,
      raw.endLine,
      contributors,
      emailMap,
    );

    if (!blame || !blame.login) {
      blameSkipped++;
      if (blame?.authorEmail) unmatchedEmails.add(blame.authorEmail);
      continue;
    }

    const blameInfo: BlameInfo = {
      login: blame.login,
      name: blame.authorName,
      email: blame.authorEmail,
      date: Date.now(),
      commitSha: blame.commitSha,
      lineStart: raw.startLine,
      lineEnd: raw.endLine,
    };

    snippets.push({
      code: raw.code,
      language: "typescript",
      filePath: raw.filePath,
      startLine: raw.startLine,
      endLine: raw.endLine,
      type: raw.type,
      name: raw.name,
      blame: blameInfo,
    });
  }
  console.log(`[snippets] Blame done: ${snippets.length} matched, ${blameSkipped} skipped out of ${blameCount} tried (${((performance.now() - blameStart) / 1000).toFixed(1)}s)`);
  if (unmatchedEmails.size > 0) {
    console.log(`[snippets] Unmatched emails: ${[...unmatchedEmails].join(", ")}`);
  }

  return snippets;
}
