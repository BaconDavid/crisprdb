import { CountryChoroplethMap } from "@/components/CountryChoroplethMap";
import styles from "@/css/HomeDashboard.module.css";

export function CountryDistributionPanel() {
  return (
    <article className={`${styles.panel} ${styles.mapPanel}`}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Country sample distribution</h2>
        <p className={styles.panelText}>
          Country-level synthetic sample counts rendered as a Leaflet choropleth.
        </p>
      </div>

      <CountryChoroplethMap />
    </article>
  );
}
