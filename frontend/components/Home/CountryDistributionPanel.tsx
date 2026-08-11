import { CountryChoroplethMap } from "@/components/Home/CountryChoroplethMap";
import styles from "@/css/HomeDashboard.module.css";

type CountryDistributionDatum = {
  country: string;
  count: number;
  label?: string;
};

export function CountryDistributionPanel({
  countryDistribution,
}: {
  countryDistribution: CountryDistributionDatum[];
}) {
  return (
    <article className={`${styles.panel} ${styles.mapPanel}`}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Country sample distribution</h2>
        <p className={styles.panelText}>
          Country-level sample counts rendered from database records.
        </p>
      </div>

      <CountryChoroplethMap countryDistribution={countryDistribution} />
    </article>
  );
}
