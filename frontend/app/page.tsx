import { HomeDashboard } from "@/components/Home/HomeDashboard";
import { Navigation } from "@/components/Home/Navigation";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <Navigation />
      <HomeDashboard />
    </div>
  );
}
