import type { Edge, Node } from "@xyflow/react";

export type Provider = "github";
export type AnalysisRunState = "queued" | "leased" | "processing" | "completed" | "failed" | "dead_letter";
export type RiskLevel = "critical" | "warning" | "healthy";
export type AnalysisMode = "full" | "reduced" | "degraded";

export interface AnalysisRunStatus {
  id: string;
  status: AnalysisRunState;
  progressPhase: string;
  progressPct: number;
  errorMessage: string | null;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  commitWindowStart: string;
  commitWindowEnd: string;
  commitLimit: number;
  snapshotId: string | null;
  attemptCount: number;
  maxAttempts: number;
  leasedAt: string | null;
  leaseExpiresAt: string | null;
  workerId: string | null;
  lastErrorCode: string | null;
  processedCommitCount: number;
  selectedCommitCount: number;
}

export interface RepositorySummary {
  id: string;
  provider: Provider;
  providerRepoId: number;
  ownerLogin: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  providerUpdatedAt: string | null;
  providerPushedAt: string | null;
  lastSeenAt: string;
  hasSnapshot: boolean;
  lastAnalyzedAt: string | null;
  stale: boolean;
  latestRun: AnalysisRunStatus | null;
}

export interface OwnershipOwnerShare {
  ownerKey: string;
  ownerLogin: string | null;
  displayName: string;
  normalizedScore: number;
  rawScore: number;
  rank: number;
}

export interface OwnershipNode {
  path: string;
  label: string;
  nodeType: "file" | "folder";
  depth: number;
  parentPath: string | null;
  leadingOwnerId: string | null;
  leadingOwnerShare: number;
  busFactor: number;
  riskLevel: RiskLevel;
  rawScoreTotal: number;
  fileCount: number;
  ownerCount: number;
  owners: OwnershipOwnerShare[];
}

export interface OwnershipTreeNode {
  path: string;
  label: string;
  riskLevel: RiskLevel;
  nodeType: "file" | "folder";
  leadingOwnerId: string | null;
  children: OwnershipTreeNode[];
}

export interface OwnershipGraphNodeData extends Record<string, unknown> {
  label: string;
  path: string;
  riskLevel: RiskLevel;
  leadingOwnerId: string | null;
  leadingOwnerShare: number;
  busFactor: number;
  nodeType: "file" | "folder";
}

export type OwnershipGraphNode = Node<OwnershipGraphNodeData>;
export type OwnershipGraphEdge = Edge<{ label?: string | null }>;

export interface OwnershipMapResponse {
  repository: RepositorySummary;
  latestSnapshotId: string | null;
  lastAnalyzedAt: string | null;
  stale: boolean;
  analysisMode: AnalysisMode | null;
  degradedReason: string | null;
  treeFileCount: number;
  commitCountProcessed: number;
  summary: {
    highRiskModules: number;
    healthyModules: number;
    leadingOwnerCoverage: number;
    activeRun: AnalysisRunStatus | null;
  };
  filters: {
    riskLevels: RiskLevel[];
  };
  tree: OwnershipTreeNode[];
  nodes: OwnershipGraphNode[];
  edges: OwnershipGraphEdge[];
  details: OwnershipNode[];
}
