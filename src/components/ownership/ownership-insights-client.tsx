"use client";

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";

import Link from "next/link";

import { formatDistanceToNow } from "date-fns";
import { Activity, AlertTriangle, ChevronDown, ChevronRight, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";

import { rerunRepositoryAnalysisAction } from "@/src/actions/analysis";
import { cn } from "@/src/lib/utils";
import type {
  OwnershipMapResponse,
  OwnershipNode,
  OwnershipTreeNode,
  RiskLevel,
} from "@/src/types/domain";

const riskTone: Record<RiskLevel, string> = {
  critical: "border-red-500/30 bg-red-500/10 text-red-500",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  healthy: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
};

function busFactorDefinition() {
  return "Bus factor is the number of top contributors needed to cover 70% of the recent weighted ownership for a file or folder.";
}

function describeRiskLevel(node: OwnershipNode) {
  const leadShare = Math.round(node.leadingOwnerShare * 100);

  if (node.busFactor <= 1) {
    return `${leadShare}% of the recent ownership score is concentrated with one top owner, so this node is marked critical.`;
  }

  if (node.busFactor === 2) {
    return "Two people are needed to cover 70% of the recent ownership score here, so this node is marked warning.";
  }

  return `${node.busFactor} people are needed to cover 70% of the recent ownership score here, so this node is considered healthy.`;
}

function findNodeByPath(nodes: OwnershipNode[], path: string | null) {
  if (!path) {
    return nodes[0] ?? null;
  }

  return nodes.find((node) => node.path === path) ?? nodes[0] ?? null;
}

function getTreeDepth(path: string) {
  if (path === "/") {
    return 0;
  }

  return path.split("/").filter(Boolean).length;
}

function collectInitiallyExpandedPaths(branches: OwnershipTreeNode[], maxDepth: number) {
  const expanded = new Set<string>();

  const visit = (branch: OwnershipTreeNode) => {
    if (getTreeDepth(branch.path) <= maxDepth) {
      expanded.add(branch.path);
    }

    branch.children.forEach(visit);
  };

  branches.forEach(visit);
  return expanded;
}

function TreeBranch({
  branch,
  selectedPath,
  onSelect,
  expandedPaths,
  onToggleExpanded,
  forceExpanded,
}: {
  branch: OwnershipTreeNode;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  expandedPaths: Set<string>;
  onToggleExpanded: (path: string) => void;
  forceExpanded: boolean;
}) {
  const hasChildren = branch.children.length > 0;
  const isExpanded = forceExpanded || expandedPaths.has(branch.path);

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border px-3 py-2 transition-all duration-300",
          selectedPath === branch.path
            ? "border-white/20 bg-white/10 text-white"
            : "border-white/5 bg-transparent text-zinc-400 hover:bg-white/5 hover:border-white/10",
        )}
      >
        <button
          type="button"
          onClick={() => {
            if (hasChildren) {
              onToggleExpanded(branch.path);
            }
          }}
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/20 text-zinc-400 transition hover:text-white",
            !hasChildren && "opacity-40",
          )}
          aria-label={hasChildren ? (isExpanded ? "Collapse branch" : "Expand branch") : "Leaf node"}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <span className="text-[10px]">•</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => onSelect(branch.path)}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <p className="truncate font-mono text-xs">{branch.label}</p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-zinc-500">{branch.nodeType}</p>
          </div>
          <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest", riskTone[branch.riskLevel])}>
            {branch.riskLevel}
          </span>
        </button>
      </div>
      {hasChildren && isExpanded ? (
        <div className="ml-5 space-y-2 border-l border-white/10 pl-4 py-1">
          {branch.children.map((child) => (
            <TreeBranch
              key={child.path}
              branch={child}
              selectedPath={selectedPath}
              onSelect={onSelect}
              expandedPaths={expandedPaths}
              onToggleExpanded={onToggleExpanded}
              forceExpanded={forceExpanded}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function OwnershipInsightsClient({ repositoryId }: { repositoryId: string }) {
  const [data, setData] = useState<OwnershipMapResponse | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [treeQuery, setTreeQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [refreshTick, setRefreshTick] = useState(0);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const deferredTreeQuery = useDeferredValue(treeQuery);

  useEffect(() => {
    let cancelled = false;

    async function loadOwnershipMap() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/v1/repositories/${repositoryId}/ownership-map`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load the ownership map.");
        }

        const payload = (await response.json()) as OwnershipMapResponse;

        if (!cancelled) {
          setData(payload);
          setSelectedPath((currentPath) => currentPath ?? payload.details[0]?.path ?? null);
          setExpandedPaths(collectInitiallyExpandedPaths(payload.tree, 2));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load the ownership map.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOwnershipMap();

    return () => {
      cancelled = true;
    };
  }, [repositoryId, refreshTick]);

  useEffect(() => {
    if (
      !data?.summary.activeRun ||
      data.summary.activeRun.status === "completed" ||
      data.summary.activeRun.status === "failed" ||
      data.summary.activeRun.status === "dead_letter"
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      setRefreshTick((current) => current + 1);
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [data?.summary.activeRun]);

  const selectedNode = useMemo(
    () => findNodeByPath(data?.details ?? [], selectedPath),
    [data?.details, selectedPath],
  );

  const filteredTree = useMemo(() => {
    if (!data) {
      return [];
    }

    if (!deferredTreeQuery.trim()) {
      return data.tree;
    }

    const search = deferredTreeQuery.trim().toLowerCase();

    const filterBranch = (branch: OwnershipTreeNode): OwnershipTreeNode | null => {
      const children = branch.children
        .map((child) => filterBranch(child))
        .filter((child): child is OwnershipTreeNode => Boolean(child));

      if (
        branch.label.toLowerCase().includes(search) ||
        branch.path.toLowerCase().includes(search) ||
        children.length
      ) {
        return {
          ...branch,
          children,
        };
      }

      return null;
    };

    return data.tree
      .map((branch) => filterBranch(branch))
      .filter((branch): branch is OwnershipTreeNode => Boolean(branch));
  }, [data, deferredTreeQuery]);

  const forceExpandedTree = deferredTreeQuery.trim().length > 0;

  if (loading && !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-zinc-500 font-mono text-[10px] uppercase tracking-widest gap-4">
        <LoaderCircle className="h-6 w-6 animate-spin text-white/50" />
        Loading ownership map...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 text-center mt-12">
        <p className="text-sm font-mono text-red-400">{error ?? "Unable to load this repository."}</p>
        <Link href="/repositories" className="mt-6 inline-flex text-[10px] font-mono uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">
          Return to repositories
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 lg:p-10 relative z-20">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 mb-3">Ownership insights</p>
            <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-white mb-4">{data.repository.fullName}</h1>
            <p className="max-w-3xl text-sm leading-relaxed text-zinc-400 font-mono">
              Explore ownership across folders and files, drill deeper only when you need it, and rerun the analysis whenever the cache gets stale.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await rerunRepositoryAnalysisAction(repositoryId);
                  setRefreshTick((current) => current + 1);
                })
              }
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-zinc-300 transition hover:border-white/50 hover:bg-white/5 hover:text-white disabled:opacity-50"
            >
              {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {data.repository.hasSnapshot ? "Re-run analysis" : "Run analysis"}
            </button>
          </div>
        </div>

        <div className="mt-10 grid gap-4 grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5 flex flex-col items-center justify-center text-center">
            <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-2">High-risk modules</p>
            <p className="text-3xl font-light text-white">{data.summary.highRiskModules}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5 flex flex-col items-center justify-center text-center">
            <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-2">Healthy modules</p>
            <p className="text-3xl font-light text-white">{data.summary.healthyModules}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5 flex flex-col items-center justify-center text-center">
            <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-2">Lead coverage</p>
            <p className="text-3xl font-light text-white">{Math.round(data.summary.leadingOwnerCoverage * 100)}%</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-5 flex flex-col items-center justify-center text-center">
            <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-2">Last analyzed</p>
            <p className="text-lg font-light text-white mt-1">
              {data.lastAnalyzedAt ? formatDistanceToNow(new Date(data.lastAnalyzedAt), { addSuffix: true }).replace("about ", "") : "Never"}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[9px] font-mono tracking-widest text-zinc-400 uppercase">
            Mode <span className="text-white ml-2">{data.analysisMode ?? "pending"}</span>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[9px] font-mono tracking-widest text-zinc-400 uppercase">
            Tree files <span className="text-white ml-2">{data.treeFileCount ?? 0}</span>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[9px] font-mono tracking-widest text-zinc-400 uppercase">
            Commits parsed <span className="text-white ml-2">{data.commitCountProcessed ?? 0}</span>
          </div>
          {data.degradedReason ? (
            <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-[9px] font-mono tracking-widest text-amber-500 uppercase">
              {data.degradedReason}
            </div>
          ) : null}
        </div>

        {data.summary.activeRun ? (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-xs font-mono text-white/90">
            <Activity className="h-4 w-4 shrink-0" />
            {data.summary.activeRun.status === "failed" || data.summary.activeRun.status === "dead_letter"
              ? (data.summary.activeRun.errorMessage ?? "Latest analysis failed.")
              : `Analysis ${data.summary.activeRun.status}: ${data.summary.activeRun.progressPhase} (${data.summary.activeRun.progressPct}%)${data.summary.activeRun.selectedCommitCount ? ` • ${data.summary.activeRun.processedCommitCount}/${data.summary.activeRun.selectedCommitCount} commits` : ""}`}
          </div>
        ) : null}

        <details className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
          <summary className="cursor-pointer list-none font-mono text-[10px] uppercase tracking-widest text-zinc-400">
            How to read this map
          </summary>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Bus factor</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{busFactorDefinition()}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Risk labels</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Critical means one person dominates the node. Warning means two people carry most of it.
                Healthy means ownership is spread wider.
              </p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">High-risk modules</p>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                This counts nodes currently labeled critical based on recent weighted Git activity, not broken code.
              </p>
            </div>
          </div>
        </details>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <aside className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6 lg:p-8 flex flex-col h-[600px]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-light text-white tracking-tight">Repository Tree</h2>
            {data.stale ? (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[9px] font-mono uppercase tracking-widest text-amber-400">
                Stale
              </span>
            ) : (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[9px] font-mono uppercase tracking-widest text-emerald-400">
                Fresh
              </span>
            )}
          </div>
          <input
            value={treeQuery}
            onChange={(event) => setTreeQuery(event.target.value)}
            placeholder="Search hierarchy..."
            className="w-full rounded-full border border-white/10 bg-black/20 px-5 py-3 text-sm text-white font-mono outline-none transition focus:border-white/30 tracking-wide mb-6"
          />
          <div className="flex-1 overflow-y-auto pr-2 space-y-2">
            {filteredTree.map((branch) => (
              <TreeBranch
                key={branch.path}
                branch={branch}
                selectedPath={selectedPath}
                onSelect={setSelectedPath}
                expandedPaths={expandedPaths}
                onToggleExpanded={(path) =>
                  setExpandedPaths((current) => {
                    const next = new Set(current);

                    if (next.has(path)) {
                      next.delete(path);
                    } else {
                      next.add(path);
                    }

                    return next;
                  })
                }
                forceExpanded={forceExpandedTree}
              />
            ))}
          </div>
        </aside>

        <aside className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6 lg:p-8 flex flex-col h-[600px] overflow-y-auto">
          {selectedNode ? (
            <div className="flex flex-col h-full">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 mb-2">Selected Node</p>
                  <h2 className="text-2xl font-light text-white tracking-tight truncate">{selectedNode.label}</h2>
                  <p className="font-mono mt-2 text-xs text-zinc-500 truncate" title={selectedNode.path}>{selectedNode.path}</p>
                </div>
                <span className={cn("shrink-0 rounded-full border px-3 py-1 text-[10px] font-mono uppercase tracking-widest", riskTone[selectedNode.riskLevel])}>
                  {selectedNode.riskLevel}
                </span>
              </div>

              <div className="mt-8 grid gap-4 grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 flex flex-col items-center justify-center text-center">
                  <div className="flex items-center gap-2 font-mono text-[9px] tracking-widest uppercase text-zinc-500 mb-3">
                    <AlertTriangle className="h-3 w-3 text-amber-400" />
                    Bus factor
                  </div>
                  <p className="text-3xl font-light text-white">{selectedNode.busFactor}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 flex flex-col items-center justify-center text-center">
                  <div className="flex items-center gap-2 font-mono text-[9px] tracking-widest uppercase text-zinc-500 mb-3">
                    <ShieldCheck className="h-3 w-3 text-emerald-400" />
                    File count
                  </div>
                  <p className="text-3xl font-light text-white">{selectedNode.fileCount}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                  Why this node is {selectedNode.riskLevel}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">{describeRiskLevel(selectedNode)}</p>
                <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                  {busFactorDefinition()}
                </p>
              </div>

              <div className="mt-8 flex-1 flex flex-col min-h-0">
                <p className="text-[10px] font-mono tracking-widest uppercase text-white mb-4">Top Owners</p>
                <div className="space-y-3 flex-1 overflow-y-auto pr-2">
                  {selectedNode.owners.slice(0, 5).map((owner) => (
                    <div
                      key={`${selectedNode.path}-${owner.ownerKey}`}
                      className="rounded-2xl border border-white/5 bg-white/5 p-4 flex items-center justify-between gap-4 transition-colors hover:bg-white/10"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-light text-white truncate">{owner.displayName}</p>
                        <p className="font-mono mt-1 text-[10px] text-zinc-500 truncate">
                          {owner.ownerLogin ?? owner.ownerKey}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-light text-white">
                          {Math.round(owner.normalizedScore * 100)}%
                        </p>
                        <p className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest mt-1">
                          {owner.rawScore.toFixed(1)} score
                        </p>
                      </div>
                    </div>
                  ))}
                  {selectedNode.owners.length === 0 && (
                    <div className="text-center py-6 text-xs font-mono text-zinc-500 uppercase tracking-widest">
                      No owners tracked
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs font-mono uppercase tracking-widest text-zinc-500 text-center">
              Select a folder or file from the tree to inspect ownership dynamics.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
