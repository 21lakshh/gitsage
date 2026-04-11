// deno-lint-ignore-file no-explicit-any
import postgres from "npm:postgres@3.4.7";
import { Octokit } from "npm:@octokit/rest@22.0.1";

import {
  DEFAULT_COMMIT_BATCH_SIZE,
  FULL_HISTORY_WINDOW_START,
  MAX_COMMIT_FETCH_LIMIT,
  type AnalysisJobStage,
  type OwnershipAnalysisQueueMessage,
} from "../../../src/services/analysis/runtime.ts";
import { buildOwnershipAnalysis, type GitHubCommitActivity } from "../_shared/ownership.ts";

const WEBHOOK_SECRET = Deno.env.get("OWNERSHIP_ANALYSIS_WEBHOOK_SECRET");
const DB_URL = Deno.env.get("ANALYSIS_DATABASE_URL");
const ENCRYPTION_KEY = Deno.env.get("GITHUB_TOKEN_ENCRYPTION_KEY");
const COMMIT_DETAIL_CONCURRENCY = Number(Deno.env.get("ANALYSIS_COMMIT_DETAIL_CONCURRENCY") ?? "5");
const COMMIT_BATCH_SIZE = Number(Deno.env.get("ANALYSIS_COMMIT_BATCH_SIZE") ?? String(DEFAULT_COMMIT_BATCH_SIZE));
const LOCK_LEASE_SECONDS = Number(Deno.env.get("ANALYSIS_LOCK_LEASE_SECONDS") ?? "900");
const MAX_ATTEMPTS = 3;

const IGNORED_DIRECTORY_SEGMENTS = new Set([
  ".git",
  ".github",
  ".next",
  ".turbo",
  "assets",
  "build",
  "coverage",
  "dist",
  "docs",
  "fixtures",
  "mocks",
  "node_modules",
  "public",
  "storybook-static",
  "tmp",
  "vendor",
]);

const IGNORED_FILE_BASENAMES = new Set([
  ".dockerignore",
  ".env",
  ".env.example",
  ".gitignore",
  "bun.lockb",
  "package-lock.json",
  "pnpm-lock.yaml",
  "readme.md",
  "yarn.lock",
]);

const CODE_FILE_EXTENSIONS = new Set([
  "c",
  "cc",
  "cpp",
  "cs",
  "css",
  "go",
  "h",
  "hpp",
  "html",
  "java",
  "js",
  "jsx",
  "kt",
  "mjs",
  "php",
  "py",
  "rb",
  "rs",
  "scala",
  "sh",
  "sql",
  "swift",
  "ts",
  "tsx",
]);

const RETRYABLE_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);

function createDb() {
  if (!DB_URL) {
    throw new Error("ANALYSIS_DATABASE_URL is required.");
  }

  return postgres(DB_URL, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 30,
  });
}

function getBasename(path: string) {
  const segments = path.split("/").filter(Boolean);
  return segments.at(-1)?.toLowerCase() ?? path.toLowerCase();
}

function getExtension(path: string) {
  const basename = getBasename(path);
  const extension = basename.split(".").at(-1);
  if (!extension || extension === basename) {
    return "";
  }

  return extension.toLowerCase();
}

function isRelevantCodeFile(path: string) {
  const normalizedPath = path.trim().replace(/^\/+/, "");
  if (!normalizedPath) {
    return false;
  }

  const segments = normalizedPath.split("/").filter(Boolean);
  const basename = getBasename(normalizedPath);
  const extension = getExtension(normalizedPath);

  if (IGNORED_FILE_BASENAMES.has(basename)) {
    return false;
  }

  if (segments.some((segment) => IGNORED_DIRECTORY_SEGMENTS.has(segment.toLowerCase()))) {
    return false;
  }

  return CODE_FILE_EXTENSIONS.has(extension);
}

function normalizeAuthor(author: {
  login?: string | null;
  name?: string | null;
  email?: string | null;
}) {
  if (author.login) {
    return {
      ownerKey: `github:${author.login.toLowerCase()}`,
      ownerLogin: author.login.toLowerCase(),
      displayName: author.login,
    };
  }

  const normalizedName = (author.name ?? "Unknown author").trim() || "Unknown author";
  const normalizedEmail = (author.email ?? "unknown@example.com").trim().toLowerCase();

  return {
    ownerKey: `commit:${normalizedName.toLowerCase()}<${normalizedEmail}>`,
    ownerLogin: null,
    displayName: normalizedName,
  };
}

async function deriveEncryptionKey() {
  if (!ENCRYPTION_KEY) {
    throw new Error("GITHUB_TOKEN_ENCRYPTION_KEY is required.");
  }

  const encoded = new TextEncoder().encode(ENCRYPTION_KEY);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["decrypt"]);
}

function decodeBase64(input: string) {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function decryptValue(payload: string) {
  const [ivBase64, authTagBase64, encryptedBase64] = payload.split(":");

  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error("Malformed encrypted token payload.");
  }

  const key = await deriveEncryptionKey();
  const iv = decodeBase64(ivBase64);
  const authTag = decodeBase64(authTagBase64);
  const encrypted = decodeBase64(encryptedBase64);
  const cipherWithTag = new Uint8Array(encrypted.length + authTag.length);
  cipherWithTag.set(encrypted, 0);
  cipherWithTag.set(authTag, encrypted.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    cipherWithTag,
  );

  return new TextDecoder().decode(decrypted);
}

async function mapWithConcurrency<TInput, TResult>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TResult>,
) {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results;
}

function classifyAnalysisError(error: unknown) {
  const status =
    typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
      ? error.status
      : null;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
        ? error.message
        : "Unknown analysis error.";
  const normalized = message.toLowerCase();

  if (normalized.includes("too large")) {
    return { code: "repository_too_large", message, retryable: false };
  }

  if (status === 401) {
    return { code: "github_auth", message, retryable: false };
  }

  if (status === 403 || status === 404) {
    if (normalized.includes("rate limit") || normalized.includes("secondary rate")) {
      return { code: "github_rate_limit", message, retryable: true };
    }

    return { code: "github_permissions", message, retryable: false };
  }

  if (status !== null && RETRYABLE_STATUSES.has(status)) {
    return { code: "github_network", message, retryable: true };
  }

  if (normalized.includes("network") || normalized.includes("timed out") || normalized.includes("econnreset")) {
    return { code: "github_network", message, retryable: true };
  }

  if (normalized.includes("insert") || normalized.includes("update") || normalized.includes("postgres")) {
    return { code: "persistence_error", message, retryable: true };
  }

  return { code: "unknown", message, retryable: true };
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

    await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
    return withRetry(operation, attempt + 1);
  }
}

function createGitHubClient(accessToken: string) {
  return new Octokit({
    auth: accessToken,
    userAgent: "GitSage Edge Worker",
  });
}

async function fetchRepositoryTree(input: {
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
    .map((entry) => entry.path as string)
    .filter((path) => isRelevantCodeFile(path));
}

async function fetchCommitManifest(input: {
  accessToken: string;
  owner: string;
  repo: string;
  defaultBranch: string;
}) {
  const octokit = createGitHubClient(input.accessToken);
  const commits: Array<{ sha: string; committedAt: string }> = [];

  for await (const response of octokit.paginate.iterator(octokit.rest.repos.listCommits, {
    owner: input.owner,
    repo: input.repo,
    sha: input.defaultBranch,
    since: FULL_HISTORY_WINDOW_START,
    per_page: 100,
  })) {
    for (const commit of response.data) {
      commits.push({
        sha: commit.sha,
        committedAt: commit.commit.committer?.date ?? commit.commit.author?.date ?? new Date().toISOString(),
      });
    }

    if (commits.length >= MAX_COMMIT_FETCH_LIMIT) {
      break;
    }
  }

  return commits.slice(0, MAX_COMMIT_FETCH_LIMIT).reverse();
}

async function fetchCommitBatchActivities(input: {
  accessToken: string;
  owner: string;
  repo: string;
  commits: Array<{ sha: string; committedAt: string; commitSequence: number }>;
}) {
  const octokit = createGitHubClient(input.accessToken);

  return mapWithConcurrency(input.commits, COMMIT_DETAIL_CONCURRENCY, async (commit) => {
    const { data } = await withRetry(() =>
      octokit.rest.repos.getCommit({
        owner: input.owner,
        repo: input.repo,
        ref: commit.sha,
      }),
    );

    return {
      sha: data.sha,
      committedAt: commit.committedAt,
      commitSequence: commit.commitSequence,
      author: normalizeAuthor({
        login: data.author?.login,
        name: data.commit.author?.name,
        email: data.commit.author?.email,
      }),
      files: (data.files ?? [])
        .filter((file) => ((file.additions ?? 0) + (file.deletions ?? 0) > 0) && isRelevantCodeFile(file.filename))
        .map((file) => ({
          filename: file.filename,
          additions: file.additions ?? 0,
          deletions: file.deletions ?? 0,
          status: file.status ?? "modified",
        })),
    };
  });
}

type QueueWebhookPayload = {
  record?: {
    msg_id: number;
    message: OwnershipAnalysisQueueMessage | string;
  };
};

function normalizeWebhookPayload(rawPayload: unknown): {
  msgId: number;
  message: OwnershipAnalysisQueueMessage;
} | null {
  if (!rawPayload || typeof rawPayload !== "object") {
    return null;
  }

  const record =
    "record" in rawPayload && rawPayload.record && typeof rawPayload.record === "object"
      ? rawPayload.record
      : null;

  if (!record || !("msg_id" in record)) {
    return null;
  }

  const msgId = Number(record.msg_id);
  if (!Number.isFinite(msgId) || msgId <= 0) {
    return null;
  }

  if (!("message" in record)) {
    return null;
  }

  const rawMessage = record.message;
  const parsedMessage =
    typeof rawMessage === "string"
      ? (() => {
          try {
            return JSON.parse(rawMessage);
          } catch {
            return null;
          }
        })()
      : rawMessage;

  if (!parsedMessage || typeof parsedMessage !== "object") {
    return null;
  }

  const message = parsedMessage as Partial<OwnershipAnalysisQueueMessage>;
  if (
    typeof message.run_id !== "string" ||
    typeof message.repository_id !== "string" ||
    typeof message.user_id !== "string" ||
    typeof message.stage !== "string" ||
    typeof message.attempt !== "number"
  ) {
    return null;
  }

  return {
    msgId,
    message: message as OwnershipAnalysisQueueMessage,
  };
}

async function claimMessage(sql: postgres.Sql, msgId: number, runId: string, stage: string) {
  const rows = await sql`
    insert into public.analysis_job_claims (msg_id, run_id, stage)
    values (${msgId}, ${runId}::uuid, ${stage})
    on conflict (msg_id) do nothing
    returning msg_id
  `;

  return rows.length > 0;
}

async function deleteQueueMessage(sql: postgres.Sql, msgId: number) {
  await sql`select public.delete_ownership_analysis_job(${msgId})`;
}

async function enqueueStageMessage(
  sql: postgres.Sql,
  message: OwnershipAnalysisQueueMessage,
  delaySeconds = 0,
) {
  await sql`select public.enqueue_ownership_analysis_job(${JSON.stringify(message)}::jsonb, ${delaySeconds})`;
}

async function loadRun(sql: postgres.Sql, runId: string) {
  const rows = await sql`
    select *
    from public.analysis_runs
    where id = ${runId}::uuid
    limit 1
  `;

  return rows[0] ?? null;
}

async function loadRepositoryContext(sql: postgres.Sql, run: any) {
  const rows = await sql`
    select
      repositories.id,
      repositories.user_id,
      repositories.owner_login,
      repositories.name,
      repositories.full_name,
      repositories.default_branch,
      connected_accounts.access_token_encrypted
    from public.repositories
    inner join public.connected_accounts
      on connected_accounts.user_id = repositories.user_id
     and connected_accounts.provider = 'github'
    where repositories.id = ${run.repository_id}::uuid
      and repositories.user_id = ${run.user_id}::uuid
    limit 1
  `;

  const row = rows[0];

  if (!row) {
    throw new Error("Repository context missing for analysis run.");
  }

  const accessToken = await decryptValue(row.access_token_encrypted);

  return {
    repositoryId: row.id as string,
    userId: row.user_id as string,
    ownerLogin: row.owner_login as string,
    name: row.name as string,
    fullName: row.full_name as string,
    defaultBranch: row.default_branch as string,
    accessToken,
  };
}

async function setRunStatus(
  sql: postgres.Sql,
  runId: string,
  patch: {
    status?: string;
    currentStage?: string;
    progressPhase?: string;
    progressPct?: number;
    errorMessage?: string | null;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
    processedCommitCount?: number;
    selectedCommitCount?: number;
    snapshotId?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
  },
) {
  await sql`
    update public.analysis_runs
    set
      status = coalesce(${patch.status ?? null}, status),
      current_stage = coalesce(${patch.currentStage ?? null}, current_stage),
      progress_phase = coalesce(${patch.progressPhase ?? null}, progress_phase),
      progress_pct = coalesce(${patch.progressPct ?? null}, progress_pct),
      error_message = coalesce(${patch.errorMessage ?? null}, error_message),
      last_error_code = coalesce(${patch.lastErrorCode ?? null}, last_error_code),
      last_error_message = coalesce(${patch.lastErrorMessage ?? null}, last_error_message),
      processed_commit_count = coalesce(${patch.processedCommitCount ?? null}, processed_commit_count),
      selected_commit_count = coalesce(${patch.selectedCommitCount ?? null}, selected_commit_count),
      snapshot_id = coalesce(${patch.snapshotId ?? null}, snapshot_id),
      started_at = coalesce(${patch.startedAt ?? null}, started_at),
      finished_at = coalesce(${patch.finishedAt ?? null}, finished_at),
      updated_at = timezone('utc', now())
    where id = ${runId}::uuid
  `;
}

async function acquireRunLock(sql: postgres.Sql, repositoryId: string, runId: string) {
  const rows = await sql`
    select public.acquire_repository_run_lock(
      ${repositoryId}::uuid,
      ${runId}::uuid,
      ${LOCK_LEASE_SECONDS}
    ) as ok
  `;

  return Boolean(rows[0]?.ok);
}

async function renewRunLock(sql: postgres.Sql, repositoryId: string, runId: string) {
  await sql`
    select public.renew_repository_run_lock(
      ${repositoryId}::uuid,
      ${runId}::uuid,
      ${LOCK_LEASE_SECONDS}
    )
  `;
}

async function releaseRunLock(sql: postgres.Sql, repositoryId: string, runId: string) {
  await sql`
    select public.release_repository_run_lock(
      ${repositoryId}::uuid,
      ${runId}::uuid
    )
  `;
}

async function loadStageState(sql: postgres.Sql, runId: string) {
  const rows = await sql`
    select *
    from public.analysis_run_stage_state
    where run_id = ${runId}::uuid
    limit 1
  `;

  return rows[0] ?? null;
}

async function upsertStageState(sql: postgres.Sql, runId: string, patch: { nextBatchIndex?: number; batchSize?: number; treeFileCount?: number }) {
  await sql`
    insert into public.analysis_run_stage_state (run_id, next_batch_index, batch_size, tree_file_count)
    values (
      ${runId}::uuid,
      ${patch.nextBatchIndex ?? 0},
      ${patch.batchSize ?? COMMIT_BATCH_SIZE},
      ${patch.treeFileCount ?? 0}
    )
    on conflict (run_id) do update
    set
      next_batch_index = coalesce(${patch.nextBatchIndex ?? null}, public.analysis_run_stage_state.next_batch_index),
      batch_size = coalesce(${patch.batchSize ?? null}, public.analysis_run_stage_state.batch_size),
      tree_file_count = coalesce(${patch.treeFileCount ?? null}, public.analysis_run_stage_state.tree_file_count),
      updated_at = timezone('utc', now())
  `;
}

async function handlePrepare(sql: postgres.Sql, run: any, message: OwnershipAnalysisQueueMessage) {
  const context = await loadRepositoryContext(sql, run);
  const lockAcquired = await acquireRunLock(sql, context.repositoryId, run.id);

  if (!lockAcquired) {
    await setRunStatus(sql, run.id, {
      status: "queued",
      progressPhase: "waiting-for-repository-lock",
      progressPct: Math.max(run.progress_pct ?? 0, 1),
    });
    await enqueueStageMessage(sql, { ...message, attempt: message.attempt + 1 }, 15);
    return;
  }

  await setRunStatus(sql, run.id, {
    status: "processing",
    progressPhase: "fetching-tree",
    progressPct: 10,
    startedAt: run.started_at ?? new Date().toISOString(),
  });

  const treePaths = await fetchRepositoryTree({
    accessToken: context.accessToken,
    owner: context.ownerLogin,
    repo: context.name,
    defaultBranch: context.defaultBranch,
  });

  await sql`delete from public.analysis_run_tree_files where run_id = ${run.id}::uuid`;

  if (treePaths.length) {
    const rows = treePaths.map((path) => ({ run_id: run.id, path }));
    await sql`
      insert into public.analysis_run_tree_files ${sql(rows, "run_id", "path")}
      on conflict (run_id, path) do nothing
    `;
  }

  await upsertStageState(sql, run.id, {
    nextBatchIndex: 0,
    batchSize: COMMIT_BATCH_SIZE,
    treeFileCount: treePaths.length,
  });

  await setRunStatus(sql, run.id, {
    currentStage: "discover_commits",
    progressPhase: "queued-discover-commits",
    progressPct: 15,
    processedCommitCount: 0,
    selectedCommitCount: 0,
  });

  await enqueueStageMessage(sql, {
    run_id: run.id,
    repository_id: run.repository_id,
    user_id: run.user_id,
    stage: "discover_commits",
    attempt: 1,
  });
}

async function handleDiscoverCommits(sql: postgres.Sql, run: any, message: OwnershipAnalysisQueueMessage) {
  const context = await loadRepositoryContext(sql, run);
  await renewRunLock(sql, context.repositoryId, run.id);

  await setRunStatus(sql, run.id, {
    status: "processing",
    progressPhase: "discovering-commits",
    progressPct: 20,
  });

  const manifest = await fetchCommitManifest({
    accessToken: context.accessToken,
    owner: context.ownerLogin,
    repo: context.name,
    defaultBranch: context.defaultBranch,
  });

  await sql`delete from public.analysis_run_commits where run_id = ${run.id}::uuid`;

  if (manifest.length) {
    const rows = manifest.map((commit, index) => ({
      run_id: run.id,
      commit_sha: commit.sha,
      commit_sequence: index,
      committed_at: commit.committedAt,
      batch_index: Math.floor(index / COMMIT_BATCH_SIZE),
    }));

    await sql`
      insert into public.analysis_run_commits ${sql(rows, "run_id", "commit_sha", "commit_sequence", "committed_at", "batch_index")}
    `;
  }

  await setRunStatus(sql, run.id, {
    selectedCommitCount: manifest.length,
    processedCommitCount: 0,
    progressPct: manifest.length ? 25 : 85,
    progressPhase: manifest.length ? "queued-process-commit-batch" : "queued-finalize",
    currentStage: manifest.length ? "process_commit_batch" : "finalize",
  });

  if (manifest.length) {
    await enqueueStageMessage(sql, {
      run_id: run.id,
      repository_id: run.repository_id,
      user_id: run.user_id,
      stage: "process_commit_batch",
      attempt: 1,
      batch_index: 0,
    });
    return;
  }

  await enqueueStageMessage(sql, {
    run_id: run.id,
    repository_id: run.repository_id,
    user_id: run.user_id,
    stage: "finalize",
    attempt: 1,
  });
}

async function handleProcessCommitBatch(sql: postgres.Sql, run: any, message: OwnershipAnalysisQueueMessage) {
  const batchIndex = message.batch_index ?? 0;
  const stageState = await loadStageState(sql, run.id);
  const nextBatchIndex = Number(stageState?.next_batch_index ?? 0);

  if (batchIndex < nextBatchIndex) {
    return;
  }

  const context = await loadRepositoryContext(sql, run);
  await renewRunLock(sql, context.repositoryId, run.id);

  const manifest = await sql`
    select commit_sha, committed_at, commit_sequence
    from public.analysis_run_commits
    where run_id = ${run.id}::uuid
      and batch_index = ${batchIndex}
    order by commit_sequence asc
  `;

  if (!manifest.length) {
    await setRunStatus(sql, run.id, {
      currentStage: "finalize",
      progressPhase: "queued-finalize",
      progressPct: 85,
    });
    await enqueueStageMessage(sql, {
      run_id: run.id,
      repository_id: run.repository_id,
      user_id: run.user_id,
      stage: "finalize",
      attempt: 1,
    });
    return;
  }

  await setRunStatus(sql, run.id, {
    status: "processing",
    progressPhase: `processing-commit-batch-${batchIndex + 1}`,
    progressPct: Math.min(80, 30 + batchIndex * 5),
  });

  const activities = await fetchCommitBatchActivities({
    accessToken: context.accessToken,
    owner: context.ownerLogin,
    repo: context.name,
    commits: manifest.map((row) => ({
      sha: row.commit_sha as string,
      committedAt: new Date(row.committed_at as string).toISOString(),
      commitSequence: Number(row.commit_sequence),
    })),
  });

  const fileRows = activities.flatMap((activity) =>
    activity.files.map((file) => ({
      run_id: run.id,
      commit_sha: activity.sha,
      commit_sequence: activity.commitSequence,
      committed_at: activity.committedAt,
      owner_key: activity.author.ownerKey,
      owner_login: activity.author.ownerLogin,
      display_name: activity.author.displayName,
      filename: file.filename,
      additions: file.additions,
      deletions: file.deletions,
      status: file.status,
    })),
  );

  if (fileRows.length) {
    await sql`
      insert into public.analysis_run_commit_files ${sql(
        fileRows,
        "run_id",
        "commit_sha",
        "commit_sequence",
        "committed_at",
        "owner_key",
        "owner_login",
        "display_name",
        "filename",
        "additions",
        "deletions",
        "status",
      )}
      on conflict (run_id, commit_sha, filename) do update
      set
        commit_sequence = excluded.commit_sequence,
        committed_at = excluded.committed_at,
        owner_key = excluded.owner_key,
        owner_login = excluded.owner_login,
        display_name = excluded.display_name,
        additions = excluded.additions,
        deletions = excluded.deletions,
        status = excluded.status
    `;
  }

  const totalCommits = Number(run.selected_commit_count);
  const processedCommitCount = Math.min(totalCommits, (batchIndex + 1) * COMMIT_BATCH_SIZE);
  const totalBatches = totalCommits ? Math.ceil(totalCommits / COMMIT_BATCH_SIZE) : 0;

  await upsertStageState(sql, run.id, {
    nextBatchIndex: batchIndex + 1,
  });

  if (batchIndex + 1 < totalBatches) {
    await setRunStatus(sql, run.id, {
      currentStage: "process_commit_batch",
      progressPhase: "queued-next-commit-batch",
      progressPct: Math.min(85, 30 + Math.round((processedCommitCount / totalCommits) * 50)),
      processedCommitCount,
    });
    await enqueueStageMessage(sql, {
      run_id: run.id,
      repository_id: run.repository_id,
      user_id: run.user_id,
      stage: "process_commit_batch",
      attempt: 1,
      batch_index: batchIndex + 1,
    });
    return;
  }

  await setRunStatus(sql, run.id, {
    currentStage: "finalize",
    progressPhase: "queued-finalize",
    progressPct: 85,
    processedCommitCount,
  });
  await enqueueStageMessage(sql, {
    run_id: run.id,
    repository_id: run.repository_id,
    user_id: run.user_id,
    stage: "finalize",
    attempt: 1,
  });
}

async function handleFinalize(sql: postgres.Sql, run: any) {
  const context = await loadRepositoryContext(sql, run);
  await renewRunLock(sql, context.repositoryId, run.id);

  await setRunStatus(sql, run.id, {
    status: "processing",
    progressPhase: "finalizing-analysis",
    progressPct: 90,
  });

  const [treeFiles, commitFiles, stageState] = await Promise.all([
    sql`
      select path
      from public.analysis_run_tree_files
      where run_id = ${run.id}::uuid
      order by path asc
    `,
    sql`
      select *
      from public.analysis_run_commit_files
      where run_id = ${run.id}::uuid
      order by commit_sequence asc, filename asc
    `,
    loadStageState(sql, run.id),
  ]);

  const commitsBySha = new Map<string, GitHubCommitActivity>();

  for (const row of commitFiles) {
    const sha = row.commit_sha as string;

    if (!commitsBySha.has(sha)) {
      commitsBySha.set(sha, {
        sha,
        committedAt: new Date(row.committed_at as string).toISOString(),
        author: {
          ownerKey: row.owner_key as string,
          ownerLogin: (row.owner_login as string | null) ?? null,
          displayName: row.display_name as string,
        },
        files: [],
      });
    }

    commitsBySha.get(sha)?.files.push({
      filename: row.filename as string,
      additions: Number(row.additions),
      deletions: Number(row.deletions),
      status: row.status as string,
    });
  }

  const analysis = buildOwnershipAnalysis({
    repositoryLabel: context.fullName,
    filePaths: treeFiles.map((row) => row.path as string),
    commits: Array.from(commitsBySha.values()),
  });

  const snapshotRows = await sql`
    insert into public.analysis_snapshots (
      user_id,
      repository_id,
      analysis_run_id,
      analysis_mode,
      commit_count_processed,
      tree_file_count,
      degraded_reason,
      high_risk_modules,
      healthy_modules,
      leading_owner_coverage,
      node_count
    )
    values (
      ${run.user_id}::uuid,
      ${run.repository_id}::uuid,
      ${run.id}::uuid,
      'full',
      ${commitsBySha.size},
      ${Number(stageState?.tree_file_count ?? treeFiles.length)},
      null,
      ${analysis.summary.highRiskModules},
      ${analysis.summary.healthyModules},
      ${analysis.summary.leadingOwnerCoverage},
      ${analysis.details.length}
    )
    returning id
  `;

  const snapshotId = snapshotRows[0].id as string;

  if (analysis.details.length) {
    const nodeRows = analysis.details.map((node) => ({
      snapshot_id: snapshotId,
      path: node.path,
      label: node.label,
      node_type: node.nodeType,
      depth: node.depth,
      parent_path: node.parentPath,
      leading_owner_id: node.leadingOwnerId,
      leading_owner_share: node.leadingOwnerShare,
      bus_factor: node.busFactor,
      risk_level: node.riskLevel,
      raw_score_total: node.rawScoreTotal,
      file_count: node.fileCount,
      owner_count: node.ownerCount,
    }));

    await sql`
      insert into public.analysis_nodes ${sql(
        nodeRows,
        "snapshot_id",
        "path",
        "label",
        "node_type",
        "depth",
        "parent_path",
        "leading_owner_id",
        "leading_owner_share",
        "bus_factor",
        "risk_level",
        "raw_score_total",
        "file_count",
        "owner_count",
      )}
    `;

    const ownerRows = analysis.details.flatMap((node) =>
      node.owners.map((owner) => ({
        snapshot_id: snapshotId,
        node_path: node.path,
        owner_key: owner.ownerKey,
        owner_login: owner.ownerLogin,
        display_name: owner.displayName,
        normalized_score: owner.normalizedScore,
        raw_score: owner.rawScore,
        rank: owner.rank,
      })),
    );

    if (ownerRows.length) {
      await sql`
        insert into public.analysis_node_owners ${sql(
          ownerRows,
          "snapshot_id",
          "node_path",
          "owner_key",
          "owner_login",
          "display_name",
          "normalized_score",
          "raw_score",
          "rank",
        )}
      `;
    }

    const edgeRows = analysis.edges.map((edge) => ({
      snapshot_id: snapshotId,
      source_path: edge.source,
      target_path: edge.target,
      label: edge.data?.label ?? null,
    }));

    if (edgeRows.length) {
      await sql`
        insert into public.analysis_graph_edges ${sql(edgeRows, "snapshot_id", "source_path", "target_path", "label")}
      `;
    }
  }

  await setRunStatus(sql, run.id, {
    status: "completed",
    currentStage: "finalize",
    progressPhase: "completed",
    progressPct: 100,
    snapshotId,
    finishedAt: new Date().toISOString(),
    processedCommitCount: commitsBySha.size,
    errorMessage: null,
    lastErrorCode: null,
    lastErrorMessage: null,
  });

  await releaseRunLock(sql, context.repositoryId, run.id);
}

async function processMessage(sql: postgres.Sql, msgId: number, message: OwnershipAnalysisQueueMessage) {
  const run = await loadRun(sql, message.run_id);

  if (!run) {
    return;
  }

  if (["completed", "failed", "dead_letter"].includes(run.status)) {
    return;
  }

  if (run.current_stage !== message.stage) {
    return;
  }

  if (message.stage === "prepare") {
    await handlePrepare(sql, run, message);
    return;
  }

  if (message.stage === "discover_commits") {
    await handleDiscoverCommits(sql, run, message);
    return;
  }

  if (message.stage === "process_commit_batch") {
    await handleProcessCommitBatch(sql, run, message);
    return;
  }

  if (message.stage === "finalize") {
    await handleFinalize(sql, run);
    return;
  }

  throw new Error(`Unsupported analysis stage for message ${msgId}.`);
}

Deno.serve(async (request) => {
  if (!WEBHOOK_SECRET) {
    return new Response("Missing webhook secret.", { status: 500 });
  }

  if (request.headers.get("x-ownership-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const rawBody = await request.text();
  let payload: QueueWebhookPayload | null = null;

  try {
    payload = JSON.parse(rawBody) as QueueWebhookPayload;
  } catch {
    console.error("Invalid webhook JSON body", rawBody);
    return new Response("Invalid webhook payload.", { status: 400 });
  }

  const normalizedPayload = normalizeWebhookPayload(payload);

  if (!normalizedPayload) {
    console.error("Unexpected webhook payload shape", rawBody);
    return new Response("Invalid webhook payload.", { status: 400 });
  }

  const sql = createDb();

  try {
    const claimed = await claimMessage(
      sql,
      normalizedPayload.msgId,
      normalizedPayload.message.run_id,
      normalizedPayload.message.stage,
    );

    if (!claimed) {
      return new Response(JSON.stringify({ status: "duplicate", msgId: normalizedPayload.msgId }), {
        status: 202,
        headers: { "content-type": "application/json" },
      });
    }

    try {
      await processMessage(sql, normalizedPayload.msgId, normalizedPayload.message);
    } catch (error) {
      const run = await loadRun(sql, normalizedPayload.message.run_id);
      const descriptor = classifyAnalysisError(error);
      const nextAttempt = normalizedPayload.message.attempt + 1;

      if (run) {
        if (descriptor.retryable && nextAttempt <= Number(run.max_attempts ?? MAX_ATTEMPTS)) {
          await setRunStatus(sql, run.id as string, {
            status: "queued",
            currentStage: normalizedPayload.message.stage,
            progressPhase: "retrying",
            errorMessage: descriptor.message,
            lastErrorCode: descriptor.code,
            lastErrorMessage: descriptor.message,
          });
          await enqueueStageMessage(sql, {
            ...normalizedPayload.message,
            attempt: nextAttempt,
          }, 15);
        } else {
          await setRunStatus(sql, run.id as string, {
            status: nextAttempt > Number(run.max_attempts ?? MAX_ATTEMPTS) ? "dead_letter" : "failed",
            currentStage: normalizedPayload.message.stage,
            progressPhase: nextAttempt > Number(run.max_attempts ?? MAX_ATTEMPTS) ? "dead-letter" : "failed",
            errorMessage: descriptor.message,
            lastErrorCode: descriptor.code,
            lastErrorMessage: descriptor.message,
            finishedAt: new Date().toISOString(),
          });
          await releaseRunLock(sql, run.repository_id as string, run.id as string).catch(() => null);
        }
      }
    } finally {
      await deleteQueueMessage(sql, normalizedPayload.msgId);
    }

    return new Response(JSON.stringify({ status: "ok", msgId: normalizedPayload.msgId }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } finally {
    await sql.end({ timeout: 5 }).catch(() => null);
  }
});
