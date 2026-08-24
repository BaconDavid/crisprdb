import type { CSSProperties } from "react";
import { Boxes, Dna, FolderKanban, Globe2 } from "lucide-react";

import styles from "@/css/HomeDashboard.module.css";

export function MetricCards({
  totalCountries,
  totalOperons,
  totalProjects,
  totalProteins,
}: {
  totalCountries: number;
  totalOperons: number;
  totalProjects: number | null;
  totalProteins: number;
}) {
  return (
    <section className={styles.metricsGrid} aria-label="Database metrics">
      <article
        className={styles.metricCard}
        style={{ "--metric-accent": "#2563eb" } as CSSProperties}
      >
        <div className={styles.metricHeader}>
          <span className={styles.metricIcon}>
            <FolderKanban aria-hidden="true" size={20} strokeWidth={1.8} />
          </span>
          <span className={styles.metricSignal} />
        </div>
        <p className={styles.metricLabel}>Total Projects</p>
        <p className={styles.metricValue}>{(totalProjects ?? 0).toLocaleString()}</p>
        <p className={styles.metricDetail}>Unique BioProject records</p>
      </article>

      <article
        className={styles.metricCard}
        style={{ "--metric-accent": "#0e7490" } as CSSProperties}
      >
        <div className={styles.metricHeader}>
          <span className={styles.metricIcon}>
            <Globe2 aria-hidden="true" size={20} strokeWidth={1.8} />
          </span>
          <span className={styles.metricSignal} />
        </div>
        <p className={styles.metricLabel}>Countries</p>
        <p className={styles.metricValue}>{totalCountries.toLocaleString()}</p>
        <p className={styles.metricDetail}>Countries represented</p>
      </article>

      <article
        className={styles.metricCard}
        style={{ "--metric-accent": "#7c3aed" } as CSSProperties}
      >
        <div className={styles.metricHeader}>
          <span className={styles.metricIcon}>
            <Boxes aria-hidden="true" size={20} strokeWidth={1.8} />
          </span>
          <span className={styles.metricSignal} />
        </div>
        <p className={styles.metricLabel}>Cas Operons</p>
        <p className={styles.metricValue}>{totalOperons.toLocaleString()}</p>
        <p className={styles.metricDetail}>Annotated CRISPR-Cas operons</p>
      </article>

      <article
        className={styles.metricCard}
        style={{ "--metric-accent": "#c2410c" } as CSSProperties}
      >
        <div className={styles.metricHeader}>
          <span className={styles.metricIcon}>
            <Dna aria-hidden="true" size={20} strokeWidth={1.8} />
          </span>
          <span className={styles.metricSignal} />
        </div>
        <p className={styles.metricLabel}>Cas-related Proteins</p>
        <p className={styles.metricValue}>{totalProteins.toLocaleString()}</p>
        <p className={styles.metricDetail}>Proteins within Cas operons</p>
      </article>
    </section>
  );
}
