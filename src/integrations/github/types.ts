export interface GitHubViewer {
  id: number;
  login: string;
  name: string | null;
}

export interface GitHubRepositoryRecord {
  providerRepoId: number;
  ownerLogin: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  providerUpdatedAt: string | null;
  providerPushedAt: string | null;
}

export interface NormalizedAuthor {
  ownerKey: string;
  ownerLogin: string | null;
  displayName: string;
}

export interface GitHubCommitFileStat {
  filename: string;
  additions: number;
  deletions: number;
  status: string;
}

export interface GitHubCommitActivity {
  sha: string;
  committedAt: string;
  author: NormalizedAuthor;
  files: GitHubCommitFileStat[];
}

export interface GitHubCommitActivityResult {
  activities: GitHubCommitActivity[];
  selectedCommitCount: number;
}
