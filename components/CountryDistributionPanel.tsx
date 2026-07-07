import { CountryChoroplethMap } from "@/components/CountryChoroplethMap";
import { countrySampleCounts } from "@/data/home";
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

      <div className={styles.locations}>
        {countrySampleCounts.map((location) => (
          <div key={location.country} className={styles.locationItem}>
            <span className={styles.locationName}>{location.label ?? location.country}</span>
            <span className={styles.locationCount}>{location.count}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
