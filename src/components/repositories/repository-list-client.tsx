"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";

import { formatDistanceToNow } from "date-fns";
import { ChevronRight, ShieldAlert, ShieldCheck } from "lucide-react";

import type { RepositorySummary } from "@/src/types/domain";

function getRepositoryActivityTimestamp(repository: RepositorySummary) {
  return repository.providerPushedAt ?? repository.providerUpdatedAt ?? repository.lastSeenAt;
}

function statusLabel(repository: RepositorySummary) {
  if (repository.latestRun?.status === "processing") {
    return `Analyzing ${repository.latestRun.progressPct}%`;
  }

  if (repository.latestRun?.status === "leased") {
    return "Worker leased";
  }

  if (repository.latestRun?.status === "queued") {
    return "Queued";
  }

  if (repository.latestRun?.status === "dead_letter") {
    return "Needs attention";
  }

  if (repository.latestRun?.status === "failed") {
    return "Failed";
  }

  if (repository.hasSnapshot) {
    return repository.stale ? "Stale snapshot" : "Cached snapshot";
  }

  return "Ready to analyze";
}

const RepositorySkeleton = () => (
  <article className="rounded-3xl border border-white/5 bg-white/5 p-6 animate-pulse">
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 w-full">
        <div className="w-24 h-3 bg-white/10 rounded mb-4" />
        <div className="w-48 h-5 bg-white/10 rounded mb-3" />
        <div className="w-32 h-3 bg-white/10 rounded" />
      </div>
      <div className="w-20 h-6 bg-white/10 rounded-full" />
    </div>
    <div className="mt-8 grid gap-2 grid-cols-3">
      <div className="rounded-xl border border-white/5 bg-white/5 h-16" />
      <div className="rounded-xl border border-white/5 bg-white/5 h-16" />
      <div className="rounded-xl border border-white/5 bg-white/5 h-16" />
    </div>
    <div className="mt-6 flex flex-wrap gap-3">
      <div className="w-36 h-9 bg-white/10 rounded-full" />
      <div className="w-40 h-9 bg-white/10 rounded-full" />
    </div>
  </article>
);

export function RepositoryListClient() {
  const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let cancelled = false;

    async function loadRepositories() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/v1/repositories?page=${pagination.page}&limit=9`, { cache: "no-store" });

        if (!response.ok) {
          throw new Error("Unable to load repositories.");
        }

        const payload = await response.json();

        if (!cancelled) {
          setRepositories(payload.data || []);
          setPagination((p) => ({ ...p, totalPages: Math.max(1, payload.totalPages || 1), total: payload.total || 0 }));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load repositories.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadRepositories();

    return () => {
      cancelled = true;
    };
  }, [pagination.page]);

  const filteredRepositories = repositories.filter((repository) =>
    repository.fullName.toLowerCase().includes(deferredQuery.trim().toLowerCase()),
  );

  return (
    <section className="bg-transparent relative z-20">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-light text-white">Accessible GitHub repositories</h2>
          <p className="mt-2 text-xs font-mono tracking-wider text-zinc-400 uppercase">
            Select a repository to explore its ownership dynamics and contributors.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="search page..."
            className="w-full rounded-full border border-white/20 bg-transparent px-5 py-3 text-sm text-white font-mono outline-none transition focus:border-white/50 sm:w-72"
          />
        </div>
      </div>

      {loading ? (
        <>
          <div className="mt-6 grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <RepositorySkeleton key={i} />
            ))}
          </div>
          {repositories.length === 0 && (
            <div className="mt-16 flex items-center justify-center gap-6 animate-pulse">
              <div className="w-28 h-10 bg-white/5 rounded-full border border-white/10" />
              <div className="flex flex-col items-center gap-2">
                <div className="w-24 h-3 bg-white/5 rounded" />
                <div className="w-12 h-2 bg-white/5 rounded" />
              </div>
              <div className="w-28 h-10 bg-white/5 rounded-full border border-white/10" />
            </div>
          )}
        </>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      ) : filteredRepositories.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm font-mono tracking-widest uppercase text-zinc-500">
          No repositories matched on this page.
        </div>
      ) : (
        <div className="mt-6 grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {filteredRepositories.map((repository) => {
            return (
              <article
                key={repository.id}
                data-cursor-hover
                className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-6 hover:border-white/20 transition-all duration-300 flex flex-col h-full"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-400 mb-1 truncate">
                      {repository.isPrivate ? "Private repo" : "Public repo"}
                    </p>
                    <h3 className="text-xl font-light text-white tracking-tight truncate" title={repository.fullName}>{repository.fullName}</h3>
                    <p className="mt-2 text-[10px] font-mono text-zinc-400 flex items-center gap-2 truncate">
                      Branch:
                      <span className="text-white px-2 py-1 bg-white/10 rounded truncate max-w-[120px] inline-block">{repository.defaultBranch}</span>
                    </p>
                  </div>
                  <div className="shrink-0 rounded-full border border-white/20 px-2 py-1 text-[9px] font-mono uppercase tracking-widest text-zinc-300 bg-white/5 whitespace-nowrap">
                    {statusLabel(repository)}
                  </div>
                </div>

                <div className="mt-auto pt-6">
                  <div className="grid gap-2 grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3 flex flex-col items-center justify-center text-center">
                      <p className="text-[8px] sm:text-[9px] font-mono tracking-widest uppercase text-zinc-500">Updated</p>
                      <p className="mt-1 text-xs font-light text-white truncate max-w-full">
                        {formatDistanceToNow(new Date(getRepositoryActivityTimestamp(repository)), { addSuffix: true }).replace("about ", "")}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3 flex flex-col items-center justify-center text-center">
                      <p className="text-[8px] sm:text-[9px] font-mono tracking-widest uppercase text-zinc-500">Scan</p>
                      <p className="mt-1 text-xs font-light text-white truncate max-w-full">
                        {repository.lastAnalyzedAt
                          ? formatDistanceToNow(new Date(repository.lastAnalyzedAt), { addSuffix: true }).replace("about ", "")
                          : "Never"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3 flex flex-col items-center justify-center text-center">
                      <p className="text-[8px] sm:text-[9px] font-mono tracking-widest uppercase text-zinc-500">Risk</p>
                      <div className="mt-1 flex items-center gap-1 text-xs font-light text-white">
                        {repository.stale || !repository.hasSnapshot ? (
                          <ShieldAlert className="h-3 w-3 text-amber-500 shrink-0" />
                        ) : (
                          <ShieldCheck className="h-3 w-3 text-emerald-500 shrink-0" />
                        )}
                        <span className="truncate">{repository.stale || !repository.hasSnapshot ? "Refresh" : "Ready"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2">
                    <Link
                      href={`/repositories/${repository.id}`}
                      className="flex-1 inline-flex justify-center items-center gap-2 rounded-full border border-white/20 px-3 py-2 text-[9px] font-mono uppercase tracking-widest text-zinc-300 transition hover:border-white/40 hover:bg-white/5 hover:text-white"
                    >
                      <span className="truncate">Open map</span>
                      <ChevronRight className="h-3 w-3 shrink-0" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!error && repositories.length > 0 && pagination.totalPages > 1 && (
        <div className="mt-16 flex items-center justify-center gap-6">
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            disabled={loading || pagination.page === 1}
            className="px-6 py-3 border border-white/20 rounded-full font-mono text-[10px] tracking-widest uppercase text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-xs tracking-widest uppercase text-zinc-400">Page {pagination.page} of {pagination.totalPages}</span>
            <span className="font-mono text-[9px] tracking-widest text-[#58a6ff]">{pagination.total} Total</span>
          </div>
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
            disabled={loading || pagination.page === pagination.totalPages}
            className="px-6 py-3 border border-white/20 rounded-full font-mono text-[10px] tracking-widest uppercase text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
