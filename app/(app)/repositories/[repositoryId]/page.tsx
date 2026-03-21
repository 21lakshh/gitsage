import { OwnershipInsightsClient } from "@/src/components/ownership/ownership-insights-client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function RepositoryOwnershipPage({
  params,
}: {
  params: Promise<{ repositoryId: string }>;
}) {
  const { repositoryId } = await params;

  return (
    <main className="space-y-6 pt-24 pb-32 px-4 bg-[#050505] min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 max-w-7xl mx-auto">
          <Link
            href="/repositories"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/10 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 text-[10px] font-mono uppercase tracking-widest transition-all hover:border-white/20 hover:-translate-x-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Repositories
          </Link>
        </div>
        <OwnershipInsightsClient repositoryId={repositoryId} />
      </div>
    </main>
  );
}
