export const MAX_COMMIT_FETCH_LIMIT = 1_000;
export const FULL_HISTORY_WINDOW_START = "1970-01-01T00:00:00.000Z";
export const DEFAULT_COMMIT_BATCH_SIZE = 75;
export const DEFAULT_MAX_ATTEMPTS = 3;

export const ANALYSIS_JOB_STAGES = [
  "prepare",
  "discover_commits",
  "process_commit_batch",
  "finalize",
] as const;

export type AnalysisJobStage = (typeof ANALYSIS_JOB_STAGES)[number];

export interface OwnershipAnalysisQueueMessage {
  run_id: string;
  repository_id: string;
  user_id: string;
  stage: AnalysisJobStage;
  attempt: number;
  batch_index?: number;
}
