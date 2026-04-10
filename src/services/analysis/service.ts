import { createServiceRoleSupabaseClient } from "@/src/services/_shared/supabase";
import { getRepositoryForUser } from "@/src/services/repositories/service";
import { enqueueOwnershipAnalysisJob } from "@/src/services/analysis/queue-service";
import {
  ANALYSIS_JOB_STAGES,
  DEFAULT_MAX_ATTEMPTS,
  FULL_HISTORY_WINDOW_START,
  MAX_COMMIT_FETCH_LIMIT,
  type AnalysisJobStage,
} from "@/src/services/analysis/runtime";
import type { Database } from "@/src/types/database";

type AnalysisRunRow = Database["public"]["Tables"]["analysis_runs"]["Row"];

function nowIso() {
  return new Date().toISOString();
}

export const INITIAL_ANALYSIS_STAGE: AnalysisJobStage = ANALYSIS_JOB_STAGES[0];

export async function getAnalysisRunForUser(input: {
  userId: string;
  repositoryId: string;
  runId: string;
}): Promise<AnalysisRunRow | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("analysis_runs")
    .select("*")
    .eq("id", input.runId)
    .eq("repository_id", input.repositoryId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as AnalysisRunRow | null) ?? null;
}

export async function enqueueAnalysisRunForRepository(input: {
  userId: string;
  repositoryId: string;
}): Promise<AnalysisRunRow> {
  const repository = await getRepositoryForUser(input.userId, input.repositoryId);

  if (!repository) {
    throw new Error("Repository not found.");
  }

  const supabase = createServiceRoleSupabaseClient();
  const commitWindowStart = FULL_HISTORY_WINDOW_START;
  const commitWindowEnd = nowIso();
  const { data, error } = await supabase
    .from("analysis_runs")
    .insert({
      user_id: input.userId,
      repository_id: input.repositoryId,
      status: "queued",
      current_stage: INITIAL_ANALYSIS_STAGE,
      progress_phase: "queued",
      progress_pct: 0,
      attempt_count: 0,
      max_attempts: DEFAULT_MAX_ATTEMPTS,
      processed_commit_count: 0,
      selected_commit_count: 0,
      commit_window_start: commitWindowStart,
      commit_window_end: commitWindowEnd,
      commit_limit: MAX_COMMIT_FETCH_LIMIT,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const run = data as AnalysisRunRow;

  await enqueueOwnershipAnalysisJob({
    run_id: run.id,
    repository_id: run.repository_id,
    user_id: run.user_id,
    stage: INITIAL_ANALYSIS_STAGE,
    attempt: 1,
  });

  return run;
}
