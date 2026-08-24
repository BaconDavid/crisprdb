import { Browse } from "@/components/Browse/Browse";
import { Navigation } from "@/components/Home/Navigation";

export default function BrowsePage() {
  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <Navigation />
      <Browse />
    </div>
  );
}
