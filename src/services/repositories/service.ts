import { differenceInHours } from "date-fns";

import { listAccessibleRepositories } from "@/src/integrations/github/service";
import { getConnectedGitHubAccountForUser } from "@/src/services/auth/service";
import { mapAnalysisRunStatus } from "@/src/services/analysis/status-service";
import { createServiceRoleSupabaseClient } from "@/src/services/_shared/supabase";
import type { Database } from "@/src/types/database";
import type { RepositorySummary } from "@/src/types/domain";

const STALE_THRESHOLD_HOURS = 24;

type RepositoryRow = Database["public"]["Tables"]["repositories"]["Row"];
type RepositoryInsert = Database["public"]["Tables"]["repositories"]["Insert"];
type SnapshotRow = Database["public"]["Tables"]["analysis_snapshots"]["Row"];
type RunRow = Database["public"]["Tables"]["analysis_runs"]["Row"];

function mapRepositorySummary(
  repository: RepositoryRow,
  snapshot: SnapshotRow | null,
  run: RunRow | null,
): RepositorySummary {
  const lastAnalyzedAt = snapshot?.generated_at ?? null;
  const stale = !lastAnalyzedAt || differenceInHours(new Date(), new Date(lastAnalyzedAt)) >= STALE_THRESHOLD_HOURS;

  return {
    id: repository.id,
    provider: repository.provider,
    providerRepoId: repository.provider_repo_id,
    ownerLogin: repository.owner_login,
    name: repository.name,
    fullName: repository.full_name,
    defaultBranch: repository.default_branch,
    isPrivate: repository.is_private,
    providerUpdatedAt: repository.provider_updated_at,
    providerPushedAt: repository.provider_pushed_at,
    lastSeenAt: repository.last_seen_at,
    hasSnapshot: Boolean(snapshot),
    lastAnalyzedAt,
    stale,
    latestRun: mapAnalysisRunStatus(run),
  };
}

async function getLatestSnapshotsByRepositoryIds(repositoryIds: string[]) {
  if (!repositoryIds.length) {
    return new Map<string, SnapshotRow>();
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("analysis_snapshots")
    .select("*")
    .in("repository_id", repositoryIds)
    .order("generated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const snapshots = (data ?? []) as SnapshotRow[];

  return snapshots.reduce((map: Map<string, SnapshotRow>, snapshot: SnapshotRow) => {
    if (!map.has(snapshot.repository_id)) {
      map.set(snapshot.repository_id, snapshot);
    }

    return map;
  }, new Map<string, SnapshotRow>());
}

async function getLatestRunsByRepositoryIds(repositoryIds: string[]) {
  if (!repositoryIds.length) {
    return new Map<string, RunRow>();
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("analysis_runs")
    .select("*")
    .in("repository_id", repositoryIds)
    .order("requested_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const runs = (data ?? []) as RunRow[];

  return runs.reduce((map: Map<string, RunRow>, run: RunRow) => {
    if (!map.has(run.repository_id)) {
      map.set(run.repository_id, run);
    }

    return map;
  }, new Map<string, RunRow>());
}

export async function syncRepositoriesForUser(userId: string) {
  const connectedAccount = await getConnectedGitHubAccountForUser(userId);

  if (!connectedAccount) {
    return [];
  }

  const repositories = await listAccessibleRepositories(connectedAccount.accessToken);
  const supabase = createServiceRoleSupabaseClient();
  const now = new Date().toISOString();

  if (repositories.length) {
    const repositoryInserts: RepositoryInsert[] = repositories.map((repository) => ({
      user_id: userId,
      provider: "github",
      provider_repo_id: repository.providerRepoId,
      owner_login: repository.ownerLogin,
      name: repository.name,
      full_name: repository.fullName,
      default_branch: repository.defaultBranch,
      is_private: repository.isPrivate,
      provider_updated_at: repository.providerUpdatedAt,
      provider_pushed_at: repository.providerPushedAt,
      last_seen_at: now,
      updated_at: now,
    }));

    const { error } = await supabase.from("repositories").upsert(
      repositoryInserts,
      { onConflict: "user_id,provider,provider_repo_id" },
    );

    if (error) {
      throw new Error(error.message);
    }
  }

  return repositories;
}

export async function listRepositorySummariesForUser(userId: string, page = 1, limit = 9) {
  const supabase = createServiceRoleSupabaseClient();
  const start = (page - 1) * limit;
  const end = start + limit - 1;

  const { data: repositories, error, count } = await supabase
    .from("repositories")
    .select("*", { count: 'exact' })
    .eq("user_id", userId)
    .order("provider_pushed_at", { ascending: false, nullsFirst: false })
    .order("provider_updated_at", { ascending: false, nullsFirst: false })
    .order("last_seen_at", { ascending: false })
    .range(start, end);

  if (error) {
    throw new Error(error.message);
  }

  const repositoryRows = (repositories ?? []) as RepositoryRow[];
  const repositoryIds = repositoryRows.map((repository) => repository.id);
  const [snapshotsByRepositoryId, runsByRepositoryId] = await Promise.all([
    getLatestSnapshotsByRepositoryIds(repositoryIds),
    getLatestRunsByRepositoryIds(repositoryIds),
  ]);

  const summaries = repositoryRows.map((repository) =>
    mapRepositorySummary(
      repository,
      snapshotsByRepositoryId.get(repository.id) ?? null,
      runsByRepositoryId.get(repository.id) ?? null,
    ),
  );

  return {
    data: summaries,
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

export async function getRepositoryForUser(userId: string, repositoryId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("repositories")
    .select("*")
    .eq("id", repositoryId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as RepositoryRow | null) ?? null;
}

export async function getRepositorySummaryForUser(userId: string, repositoryId: string) {
  const repository = await getRepositoryForUser(userId, repositoryId);

  if (!repository) {
    return null;
  }

  const [snapshotsByRepositoryId, runsByRepositoryId] = await Promise.all([
    getLatestSnapshotsByRepositoryIds([repositoryId]),
    getLatestRunsByRepositoryIds([repositoryId]),
  ]);

  return mapRepositorySummary(
    repository,
    snapshotsByRepositoryId.get(repositoryId) ?? null,
    runsByRepositoryId.get(repositoryId) ?? null,
  );
}
