import { loadEnvConfig } from "@next/env";
import { z } from "zod";

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GITHUB_TOKEN_ENCRYPTION_KEY: z.string().min(1),
  ANALYSIS_COMMIT_DETAIL_CONCURRENCY: z.coerce.number().int().positive().default(5),
  ANALYSIS_LOCK_LEASE_SECONDS: z.coerce.number().int().positive().default(900),
  ANALYSIS_PROGRESS_BATCH_SIZE: z.coerce.number().int().positive().default(10),
  ANALYSIS_COMMIT_BATCH_SIZE: z.coerce.number().int().positive().default(25),
});

const publicEnvSchema = serverEnvSchema.pick({
  NEXT_PUBLIC_SUPABASE_URL: true,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
});

let serverEnvCache: z.infer<typeof serverEnvSchema> | null = null;
let publicEnvCache: z.infer<typeof publicEnvSchema> | null = null;
let envLoaded = false;

function ensureEnvLoaded() {
  if (!envLoaded) {
    loadEnvConfig(process.cwd());
    envLoaded = true;
  }
}

export function getServerEnv() {
  ensureEnvLoaded();

  if (!serverEnvCache) {
    serverEnvCache = serverEnvSchema.parse(process.env);
  }

  return serverEnvCache;
}

export function getPublicEnv() {
  ensureEnvLoaded();

  if (!publicEnvCache) {
    publicEnvCache = publicEnvSchema.parse(process.env);
  }

  return publicEnvCache;
}
