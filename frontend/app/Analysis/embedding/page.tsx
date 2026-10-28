import EmbeddingAtlasPanel from "@/components/Analysis/embedding/embedding_atlas_panel";
import { Navigation } from "@/components/Home/Navigation";

export default function EmbeddingSearchPage() {
  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <Navigation />
      <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <EmbeddingAtlasPanel />
      </main>
    </div>
  );
}
