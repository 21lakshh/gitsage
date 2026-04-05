import { createGitHubClient } from "@/src/integrations/github/client";
import { mapWithConcurrency } from "@/src/lib/async";
import { getServerEnv } from "@/src/lib/env";
import type {
  GitHubCommitActivityResult,
  GitHubRepositoryRecord,
  GitHubViewer,
  NormalizedAuthor,
} from "@/src/integrations/github/types";

const DEFAULT_COMMIT_LIMIT = 500;
const RETRYABLE_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);

function normalizeAuthor({
  login,
  name,
  email,
}: {
  login?: string | null;
  name?: string | null;
  email?: string | null;
}): NormalizedAuthor {
  if (login) {
    return {
      ownerKey: `github:${login.toLowerCase()}`,
      ownerLogin: login.toLowerCase(),
      displayName: login,
    };
  }

  const normalizedName = (name ?? "Unknown author").trim() || "Unknown author";
  const normalizedEmail = (email ?? "unknown@example.com").trim().toLowerCase();

  return {
    ownerKey: `commit:${normalizedName.toLowerCase()}<${normalizedEmail}>`,
    ownerLogin: null,
    displayName: normalizedName,
  };
}

export function normalizeGitHubAuthor(author: {
  login?: string | null;
  name?: string | null;
  email?: string | null;
}) {
  return normalizeAuthor(author);
}

export async function fetchAuthenticatedViewer(accessToken: string): Promise<GitHubViewer> {
  const octokit = createGitHubClient(accessToken);
  const { data } = await octokit.rest.users.getAuthenticated();

  return {
    id: data.id,
    login: data.login,
    name: data.name,
  };
}

export async function listAccessibleRepositories(accessToken: string): Promise<GitHubRepositoryRecord[]> {
  const octokit = createGitHubClient(accessToken);
  const repositories = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
    affiliation: "owner,collaborator,organization_member",
    per_page: 100,
    sort: "updated",
  });

  return repositories.map((repository) => ({
    providerRepoId: repository.id,
    ownerLogin: repository.owner.login,
    name: repository.name,
    fullName: repository.full_name,
    defaultBranch: repository.default_branch,
    isPrivate: repository.private,
    providerUpdatedAt: repository.updated_at,
    providerPushedAt: repository.pushed_at,
  }));
}

export async function fetchRepositoryTree(input: {
  accessToken: string;
  owner: string;
  repo: string;
  defaultBranch: string;
}) {
  const octokit = createGitHubClient(input.accessToken);
  const branch = await octokit.rest.repos.getBranch({
    owner: input.owner,
    repo: input.repo,
    branch: input.defaultBranch,
  });

  const tree = await octokit.rest.git.getTree({
    owner: input.owner,
    repo: input.repo,
    tree_sha: branch.data.commit.sha,
    recursive: "1",
  });

  return tree.data.tree
    .filter((entry) => entry.type === "blob" && entry.path)
    .map((entry) => entry.path as string);
}

export async function fetchRecentCommitActivity(input: {
  accessToken: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  commitLimit?: number;
  since?: string;
  shouldIncludeFile?: (path: string) => boolean;
  onProgress?: (processedCount: number, totalCount: number) => Promise<void> | void;
}): Promise<GitHubCommitActivityResult> {
  const octokit = createGitHubClient(input.accessToken);
  const commitLimit = input.commitLimit ?? DEFAULT_COMMIT_LIMIT;
  const lightweightCommits: { sha: string }[] = [];

  for await (const response of octokit.paginate.iterator(octokit.rest.repos.listCommits, {
    owner: input.owner,
    repo: input.repo,
    sha: input.defaultBranch,
    since: input.since,
    per_page: 100,
  })) {
    lightweightCommits.push(...response.data);

    if (lightweightCommits.length >= commitLimit) {
      break;
    }
  }

  const slicedCommits = lightweightCommits.slice(0, commitLimit);
  let processedCount = 0;

  const activities = await mapWithConcurrency(
    slicedCommits,
    getServerEnv().ANALYSIS_COMMIT_DETAIL_CONCURRENCY,
    async (commit) => {
      const { data } = await withRetry(() =>
        octokit.rest.repos.getCommit({
          owner: input.owner,
          repo: input.repo,
          ref: commit.sha,
        }),
      );

      processedCount += 1;

      if (input.onProgress) {
        await input.onProgress(processedCount, slicedCommits.length);
      }

      return {
        sha: data.sha,
        committedAt: data.commit.committer?.date ?? data.commit.author?.date ?? new Date().toISOString(),
        author: normalizeAuthor({
          login: data.author?.login,
          name: data.commit.author?.name,
          email: data.commit.author?.email,
        }),
        files: (data.files ?? [])
          .filter((file) => {
            if ((file.additions ?? 0) + (file.deletions ?? 0) <= 0) {
              return false;
            }

            return input.shouldIncludeFile ? input.shouldIncludeFile(file.filename) : true;
          })
          .map((file) => ({
            filename: file.filename,
            additions: file.additions ?? 0,
            deletions: file.deletions ?? 0,
            status: file.status ?? "modified",
          })),
      };
    },
  );

  return {
    activities,
    selectedCommitCount: slicedCommits.length,
  };
}

async function withRetry<T>(operation: () => Promise<T>, attempt = 0): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
        ? error.status
        : null;

    if (attempt >= 2 || (status !== null && !RETRYABLE_STATUSES.has(status))) {
      throw error;
    }

    const delay = 400 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return withRetry(operation, attempt + 1);
  }
}
