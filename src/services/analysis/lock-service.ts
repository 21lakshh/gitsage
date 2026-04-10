import { getServerEnv } from "@/src/lib/env";
import { createServiceRoleSupabaseClient } from "@/src/services/_shared/supabase";

export async function acquireRepositoryRunLock(input: {
  repositoryId: string;
  runId: string;
}) {
  const supabase = createServiceRoleSupabaseClient();
  const env = getServerEnv();
  const { data, error } = await supabase.rpc("acquire_repository_run_lock", {
    target_repository_id: input.repositoryId,
    target_run_id: input.runId,
    lease_seconds: env.ANALYSIS_LOCK_LEASE_SECONDS,
  });

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function renewRepositoryRunLock(input: {
  repositoryId: string;
  runId: string;
}) {
  const supabase = createServiceRoleSupabaseClient();
  const env = getServerEnv();
  const { data, error } = await supabase.rpc("renew_repository_run_lock", {
    target_repository_id: input.repositoryId,
    target_run_id: input.runId,
    lease_seconds: env.ANALYSIS_LOCK_LEASE_SECONDS,
  });

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function releaseRepositoryRunLock(input: {
  repositoryId: string;
  runId: string;
}) {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.rpc("release_repository_run_lock", {
    target_repository_id: input.repositoryId,
    target_run_id: input.runId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}
