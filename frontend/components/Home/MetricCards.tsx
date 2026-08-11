import type { CSSProperties } from "react";
import { FolderKanban } from "lucide-react";

import styles from "@/css/HomeDashboard.module.css";

export function MetricCards({
  totalProjects,
}: {
  totalProjects: number | null;
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
        <p className={styles.metricValue}>{totalProjects ?? 0}</p>
        <p className={styles.metricDetail}>Unique BioProject records</p>
      </article>
    </section>
  );
}
