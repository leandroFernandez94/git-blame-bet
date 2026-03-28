export enum SnippetType {
  Function = "function",
  Class = "class",
  Method = "method",
  Block = "block",
  VariableDeclaration = "variable",
}

export type BlameInfo = {
  login: string;
  name: string;
  email: string;
  date: number;
  commitSha: string;
  lineStart: number;
  lineEnd: number;
};

export type Snippet = {
  code: string;
  language: string;
  filePath: string;
  startLine: number;
  endLine: number;
  type: SnippetType;
  name: string;
  blame: BlameInfo;
};
