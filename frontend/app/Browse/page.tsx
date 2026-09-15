import { Browse, type BrowseEntity } from "@/components/Browse/Browse";
import { Navigation } from "@/components/Home/Navigation";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string | string[] }>;
}) {
  const entityParam = (await searchParams).entity;
  const initialEntity: BrowseEntity = entityParam === "protein" ? "protein" : "operon";

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <Navigation />
      <Browse initialEntity={initialEntity} />
    </div>
  );
}
