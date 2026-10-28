import { Browse, type BrowseEntity } from "@/components/Browse/Browse";
import { Navigation } from "@/components/Home/Navigation";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{
    entity?: string | string[];
    protein?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const proteinHeader = typeof params.protein === "string" ? params.protein : undefined;
  const initialEntity: BrowseEntity = proteinHeader || params.entity === "protein"
    ? "protein"
    : "operon";

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <Navigation />
      <Browse
        initialEntity={initialEntity}
        initialProteinHeader={proteinHeader}
      />
    </div>
  );
}
