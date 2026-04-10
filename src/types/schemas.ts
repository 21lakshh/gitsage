import { z } from "zod";

export const providerSchema = z.literal("github");

export const analysisRunStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["queued", "processing", "completed", "failed", "dead_letter"]),
  progressPhase: z.string(),
  progressPct: z.number().min(0).max(100),
  errorMessage: z.string().nullable(),
  requestedAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  commitWindowStart: z.string(),
  commitWindowEnd: z.string(),
  commitLimit: z.number().int().positive(),
  snapshotId: z.string().uuid().nullable(),
  currentStage: z.string(),
  attemptCount: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  lastErrorCode: z.string().nullable(),
  processedCommitCount: z.number().int().nonnegative(),
  selectedCommitCount: z.number().int().nonnegative(),
});

export const repositorySummarySchema = z.object({
  id: z.string().uuid(),
  provider: providerSchema,
  providerRepoId: z.number().int().nonnegative(),
  ownerLogin: z.string(),
  name: z.string(),
  fullName: z.string(),
  defaultBranch: z.string(),
  isPrivate: z.boolean(),
  providerUpdatedAt: z.string().nullable(),
  providerPushedAt: z.string().nullable(),
  lastSeenAt: z.string(),
  hasSnapshot: z.boolean(),
  lastAnalyzedAt: z.string().nullable(),
  stale: z.boolean(),
  latestRun: analysisRunStatusSchema.nullable(),
});

export const ownershipOwnerShareSchema = z.object({
  ownerKey: z.string(),
  ownerLogin: z.string().nullable(),
  displayName: z.string(),
  normalizedScore: z.number().min(0).max(1),
  rawScore: z.number().nonnegative(),
  rank: z.number().int().positive(),
});

export const ownershipNodeSchema = z.object({
  path: z.string(),
  label: z.string(),
  nodeType: z.enum(["file", "folder"]),
  depth: z.number().int().nonnegative(),
  parentPath: z.string().nullable(),
  leadingOwnerId: z.string().nullable(),
  leadingOwnerShare: z.number().min(0).max(1),
  busFactor: z.number().int().positive(),
  riskLevel: z.enum(["critical", "warning", "healthy"]),
  rawScoreTotal: z.number().nonnegative(),
  fileCount: z.number().int().positive(),
  ownerCount: z.number().int().nonnegative(),
  owners: z.array(ownershipOwnerShareSchema),
});

export const ownershipTreeNodeSchema: z.ZodType<{
  path: string;
  label: string;
  riskLevel: "critical" | "warning" | "healthy";
  nodeType: "file" | "folder";
  leadingOwnerId: string | null;
  children: unknown[];
}> = z.lazy(() =>
  z.object({
    path: z.string(),
    label: z.string(),
    riskLevel: z.enum(["critical", "warning", "healthy"]),
    nodeType: z.enum(["file", "folder"]),
    leadingOwnerId: z.string().nullable(),
    children: z.array(ownershipTreeNodeSchema),
  }),
);

export const ownershipMapResponseSchema = z.object({
  repository: repositorySummarySchema,
  latestSnapshotId: z.string().uuid().nullable(),
  lastAnalyzedAt: z.string().nullable(),
  stale: z.boolean(),
  analysisMode: z.enum(["full", "reduced", "degraded"]).nullable(),
  degradedReason: z.string().nullable(),
  treeFileCount: z.number().int().nonnegative(),
  commitCountProcessed: z.number().int().nonnegative(),
  summary: z.object({
    highRiskModules: z.number().int().nonnegative(),
    healthyModules: z.number().int().nonnegative(),
    leadingOwnerCoverage: z.number().min(0).max(1),
    activeRun: analysisRunStatusSchema.nullable(),
  }),
  filters: z.object({
    riskLevels: z.array(z.enum(["critical", "warning", "healthy"])),
  }),
  tree: z.array(ownershipTreeNodeSchema),
  nodes: z.array(
    z.object({
      id: z.string(),
      position: z.object({ x: z.number(), y: z.number() }),
      type: z.string().optional(),
      data: z.object({
        label: z.string(),
        path: z.string(),
        riskLevel: z.enum(["critical", "warning", "healthy"]),
        leadingOwnerId: z.string().nullable(),
        leadingOwnerShare: z.number().min(0).max(1),
        busFactor: z.number().int().positive(),
        nodeType: z.enum(["file", "folder"]),
      }),
    }),
  ),
  edges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      data: z.object({ label: z.string().nullable().optional() }).optional(),
      type: z.string().optional(),
    }),
  ),
  details: z.array(ownershipNodeSchema),
});

export const repositoryIdParamsSchema = z.object({
  repositoryId: z.string().uuid(),
});

export const runParamsSchema = z.object({
  repositoryId: z.string().uuid(),
  runId: z.string().uuid(),
});
