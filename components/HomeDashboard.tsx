import { CountryDistributionPanel } from "@/components/CountryDistributionPanel";
import { DistributionPanel } from "@/components/DistributionPanel";
import { HeroSection } from "@/components/HeroSection";
import { MetricCards } from "@/components/MetricCards";
import styles from "@/css/HomeDashboard.module.css";

export function HomeDashboard() {
  return (
    <main className={styles.main}>
      <HeroSection />
      <MetricCards />

      <section className={styles.contentGrid}>
        <DistributionPanel />
        <CountryDistributionPanel />
      </section>
    </main>
  );
}
