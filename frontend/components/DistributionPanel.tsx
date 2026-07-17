import { DistributionPieChart } from "@/components/piechart";
import { classDistribution, subtypePieCharts, typeDistribution } from "@/data/home";
import styles from "@/css/HomeDashboard.module.css";

export function DistributionPanel() {
  return (
    <article className={`${styles.panel} ${styles.chartPanel}`}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>CRISPR distribution overview</h2>
        <p className={styles.panelText}>
          Synthetic class, type, and subtype composition across 100 Cas operons.
        </p>
      </div>

      <div className={styles.topPieGrid}>
        <DistributionPieChart
          description="Synthetic split across 100 Cas operons."
          items={classDistribution}
          title="Class distribution"
        />
        <DistributionPieChart
          description="Synthetic type distribution across 100 Cas operons."
          items={typeDistribution}
          title="Type distribution"
        />
      </div>

      <div className={styles.subtypePieGrid} aria-label="Subtype pie charts">
        {subtypePieCharts.map((chart) => (
          <DistributionPieChart
            description={chart.description}
            items={chart.items}
            key={chart.title}
            title={`Subtype ${chart.title.replace("Type ", "")}`}
            variant="small"
          />
        ))}
      </div>
    </article>
  );
}
