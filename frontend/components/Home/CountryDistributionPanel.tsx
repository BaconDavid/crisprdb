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
        <h2 className={styles.panelTitle}>Country Sample Distribution</h2>
      </div>

      <CountryChoroplethMap countryDistribution={countryDistribution} />
    </article>
  );
}
