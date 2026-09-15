import type { Metadata } from "next";

import { StructureWorkbench } from "@/components/Analysis/structure/StructureWorkbench";
import { Navigation } from "@/components/Home/Navigation";

export const metadata: Metadata = {
  title: "Structure Prediction · CRISPR Database",
  description: "Predict and inspect CRISPR-associated protein structures with ESMFold v1.",
};

export default async function StructurePage({
  searchParams,
}: {
  searchParams: Promise<{ protein?: string | string[] }>;
}) {
  const protein = (await searchParams).protein;
  const proteinHeader = typeof protein === "string" ? protein : undefined;

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <Navigation />
      <StructureWorkbench proteinHeader={proteinHeader} />
    </div>
  );
}
