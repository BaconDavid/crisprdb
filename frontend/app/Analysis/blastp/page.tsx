import BlastpAnalysis from "@/app/Analysis/blastp";

export default async function BlastpPage({
  searchParams,
}: {
  searchParams: Promise<{ protein?: string | string[] }>;
}) {
  const protein = (await searchParams).protein;
  const proteinHeader = typeof protein === "string" ? protein : undefined;
  return <BlastpAnalysis proteinHeader={proteinHeader} />;
}
