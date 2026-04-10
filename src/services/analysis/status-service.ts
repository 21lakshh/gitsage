import type { Database } from "@/src/types/database";
import type { AnalysisRunStatus } from "@/src/types/domain";

type RunRow = Database["public"]["Tables"]["analysis_runs"]["Row"];

export function mapAnalysisRunStatus(run: RunRow | null): AnalysisRunStatus | null {
  if (!run) {
    return null;
  }

  return {
    id: run.id,
    status: run.status,
    progressPhase: run.progress_phase,
    progressPct: run.progress_pct,
    errorMessage: run.error_message,
    requestedAt: run.requested_at,
    startedAt: run.started_at,
    finishedAt: run.finished_at,
    commitWindowStart: run.commit_window_start,
    commitWindowEnd: run.commit_window_end,
    commitLimit: run.commit_limit,
    snapshotId: run.snapshot_id,
    currentStage: run.current_stage,
    attemptCount: run.attempt_count,
    maxAttempts: run.max_attempts,
    lastErrorCode: run.last_error_code,
    processedCommitCount: run.processed_commit_count,
    selectedCommitCount: run.selected_commit_count,
  };
}
