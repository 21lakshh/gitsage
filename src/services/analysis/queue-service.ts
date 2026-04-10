import { createServiceRoleSupabaseClient } from "@/src/services/_shared/supabase";
import type { OwnershipAnalysisQueueMessage } from "@/src/services/analysis/runtime";
import type { Json } from "@/src/types/database";

export async function enqueueOwnershipAnalysisJob(message: OwnershipAnalysisQueueMessage, delaySeconds = 0) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.rpc("enqueue_ownership_analysis_job", {
    payload: message as unknown as Json,
    delay_seconds: delaySeconds,
  });

  if (error) {
    throw new Error(error.message);
  }

  return Number(data);
}
