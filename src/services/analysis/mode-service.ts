import { FULL_HISTORY_WINDOW_START, MAX_COMMIT_FETCH_LIMIT } from "@/src/services/analysis/runtime";

// in case in future we want to add modes for fetching commits....
export interface AnalysisModeSelection {
  analysisMode: "full";
  commitLimit: number;
  commitWindowStart: string;
  collapseDepth: null;
}

export function selectAnalysisMode(): AnalysisModeSelection {
  return {
    analysisMode: "full",
    commitLimit: MAX_COMMIT_FETCH_LIMIT,
    commitWindowStart: FULL_HISTORY_WINDOW_START,
    collapseDepth: null,
  };
}
