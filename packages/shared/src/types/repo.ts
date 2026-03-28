export type Contributor = {
  login: string;
  avatarUrl: string;
  commitsCount: number;
};

export type RepoInfo = {
  owner: string;
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  defaultBranch: string;
  stars: number;
  contributorsCount: number;
};

export type FileInfo = {
  path: string;
  name: string;
  extension: string;
  size: number;
  lastModified: number;
};

export type CommitInfo = {
  sha: string;
  authorLogin: string;
  authorName: string;
  message: string;
  date: number;
  files: string[];
};
