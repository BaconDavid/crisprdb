import type { CSSProperties } from "react";
import { Atom, ChartNoAxesGantt, Dna, MapPinned } from "lucide-react";

import { homeMetrics } from "@/data/home";
import styles from "@/css/HomeDashboard.module.css";

type MetricIconName = "operons" | "genomes" | "countries" | "proteins";

const metricIcons = {
  countries: MapPinned,
  genomes: Dna,
  operons: ChartNoAxesGantt,
  proteins: Atom,
};

export function MetricCards() {
  return (
    <section className={styles.metricsGrid} aria-label="Database metrics">
      {homeMetrics.map((metric) => {
        const Icon = metricIcons[metric.icon as MetricIconName];

        return (
          <article
            key={metric.label}
            className={styles.metricCard}
            style={{ "--metric-accent": metric.accentColor } as CSSProperties}
          >
            <div className={styles.metricHeader}>
              <span className={styles.metricIcon}>
                <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
              </span>
              <span className={styles.metricSignal} />
            </div>
            <p className={styles.metricLabel}>{metric.label}</p>
            <p className={styles.metricValue}>{metric.value}</p>
            <p className={styles.metricDetail}>{metric.detail}</p>
          </article>
        );
      })}
    </section>
  );
}
