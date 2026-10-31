import { DataDownloads } from "@/components/Data/DataDownloads";
import { Navigation } from "@/components/Home/Navigation";

export default function DataPage() {
  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <Navigation />
      <DataDownloads />
    </div>
  );
}
