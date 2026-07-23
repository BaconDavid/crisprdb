import { CountryDistributionPanel } from "@/components/CountryDistributionPanel";
import { DistributionPanel } from "@/components/DistributionPanel";
import { HeroSection } from "@/components/HeroSection";
import { MetricCards } from "@/components/MetricCards";
import styles from "@/css/HomeDashboard.module.css";

type HomeStatisticData = {
  total_projects: number | null;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

async function fetchHomeStatisticData(): Promise<HomeStatisticData> {
  const response = await fetch(`${API_BASE_URL}/api/home/home_statistic_data`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch home statistic data");
  }

  return response.json();
}

const homeSummaryData = {
  distributions: {
    class: [
      { label: "Class 1", value: 80 },
      { label: "Class 2", value: 20 },
    ],
    type: [
      { label: "Type I", value: 45 },
      { label: "Type II", value: 9 },
      { label: "Type III", value: 25 },
      { label: "Type IV", value: 10 },
      { label: "Type V", value: 7 },
      { label: "Type VI", value: 4 },
    ],
    subtype: [
      {
        title: "Type I",
        description: "Class 1 subtype split",
        items: [
          { label: "Type I-A", value: 12 },
          { label: "Type I-B", value: 8 },
          { label: "Type I-C", value: 15 },
          { label: "Type I-E", value: 10 },
        ],
      },
      {
        title: "Type II",
        description: "Class 2 subtype split",
        items: [
          { label: "Type II-A", value: 4 },
          { label: "Type II-B", value: 2 },
          { label: "Type II-C", value: 3 },
        ],
      },
      {
        title: "Type III",
        description: "Class 1 subtype split",
        items: [
          { label: "Type III-A", value: 8 },
          { label: "Type III-B", value: 7 },
          { label: "Type III-C", value: 5 },
          { label: "Type III-D", value: 5 },
        ],
      },
      {
        title: "Type IV",
        description: "Class 1 subtype split",
        items: [
          { label: "Type IV-A", value: 6 },
          { label: "Type IV-B", value: 4 },
        ],
      },
      {
        title: "Type V",
        description: "Class 2 subtype split",
        items: [
          { label: "Type V-A", value: 3 },
          { label: "Type V-B", value: 2 },
          { label: "Type V-C", value: 2 },
        ],
      },
      {
        title: "Type VI",
        description: "Class 2 subtype split",
        items: [
          { label: "Type VI-A", value: 2 },
          { label: "Type VI-B", value: 1 },
          { label: "Type VI-C", value: 1 },
        ],
      },
    ],
  },
};

export async function HomeDashboard() {
  const homeStatisticData = await fetchHomeStatisticData();

  return (
    <main className={styles.main}>
      <HeroSection />
      <MetricCards totalProjects={homeStatisticData.total_projects} />

      <section className={styles.contentGrid}>
        <DistributionPanel
          classDistribution={homeSummaryData.distributions.class}
          subtypeDistribution={homeSummaryData.distributions.subtype}
          typeDistribution={homeSummaryData.distributions.type}
        />
        <CountryDistributionPanel />
      </section>
    </main>
  );
}
