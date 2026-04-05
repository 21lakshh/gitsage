import { RepositoryListClient } from "@/src/components/repositories/repository-list-client";
import { requireCurrentUser } from "@/src/services/auth/service";
import { listRepositorySummariesForUser, syncRepositoriesForUser } from "@/src/services/repositories/service";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";

const REPOSITORIES_PAGE_SIZE = 9;

type RepositoriesPageProps = {
  searchParams?: Promise<{
    page?: string;
  }>;
};

export default async function RepositoriesPage({ searchParams }: RepositoriesPageProps) {
  const user = await requireCurrentUser();

  if (!user) {
    redirect("/");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const page = Math.max(1, Number.parseInt(resolvedSearchParams?.page ?? "1", 10) || 1);

  if (page === 1) {
    await syncRepositoriesForUser(user.id);
  }

  const initialRepositoriesPage = await listRepositorySummariesForUser(user.id, page, REPOSITORIES_PAGE_SIZE);

  return (
    <main className="space-y-6 pt-24 pb-32 px-4 bg-[#050505] min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/10 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 text-[10px] font-mono uppercase tracking-widest transition-all hover:border-white/20 hover:-translate-x-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
        <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl px-8 py-10 relative z-20">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-zinc-400 mb-2">Repository selection</p>
          <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-white mb-4">
            Compute the <span className="italic font-serif text-white/80">ownership graph.</span>
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-zinc-400 font-mono">
            Connect your GitHub repositories to map out code ownership. Automatically identify top
            contributors, highlight knowledge silos, and understand how your team interacts with the codebase.
          </p>
        </section>

        <div className="mt-8">
          <RepositoryListClient
            initialRepositories={initialRepositoriesPage.data}
            initialPagination={{
              page: initialRepositoriesPage.page,
              totalPages: initialRepositoriesPage.totalPages,
              total: initialRepositoriesPage.total,
            }}
            pageSize={REPOSITORIES_PAGE_SIZE}
          />
        </div>
      </div>
    </main>
  );
}
