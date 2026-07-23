import { DistributionPieChart } from "@/components/piechart";
import styles from "@/css/HomeDashboard.module.css";

type DistributionDatum = {
  label: string;
  value: number;
};

type SubtypeDistribution = {
  description: string;
  items: DistributionDatum[];
  title: string;
};

type PieDatum = DistributionDatum & {
  color: string;
};

const fallbackColors = ["#2563eb", "#f97316", "#10b981", "#8b5cf6", "#ec4899", "#eab308"];

const colorByLabel: Record<string, string> = {
  "Class 1": "#1d4ed8",
  "Class 2": "#f97316",
  "Type I": "#2563eb",
  "Type II": "#f97316",
  "Type III": "#10b981",
  "Type IV": "#8b5cf6",
  "Type V": "#ec4899",
  "Type VI": "#eab308",
  "Type I-A": "#1d4ed8",
  "Type I-B": "#3b82f6",
  "Type I-C": "#60a5fa",
  "Type I-E": "#93c5fd",
  "Type II-A": "#c2410c",
  "Type II-B": "#f97316",
  "Type II-C": "#fdba74",
  "Type III-A": "#047857",
  "Type III-B": "#10b981",
  "Type III-C": "#6ee7b7",
  "Type III-D": "#a7f3d0",
  "Type IV-A": "#7c3aed",
  "Type IV-B": "#c4b5fd",
  "Type V-A": "#db2777",
  "Type V-B": "#ec4899",
  "Type V-C": "#f9a8d4",
  "Type VI-A": "#ca8a04",
  "Type VI-B": "#eab308",
  "Type VI-C": "#fde68a",
};

function withColors(items: DistributionDatum[]): PieDatum[] {
  return items.map((item, index) => ({
    ...item,
    color: colorByLabel[item.label] ?? fallbackColors[index % fallbackColors.length],
  }));
}

export function DistributionPanel({
  classDistribution,
  subtypeDistribution,
  typeDistribution,
}: {
  classDistribution: DistributionDatum[];
  subtypeDistribution: SubtypeDistribution[];
  typeDistribution: DistributionDatum[];
}) {
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
          items={withColors(classDistribution)}
          title="Class distribution"
        />
        <DistributionPieChart
          description="Synthetic type distribution across 100 Cas operons."
          items={withColors(typeDistribution)}
          title="Type distribution"
        />
      </div>

      <div className={styles.subtypePieGrid} aria-label="Subtype pie charts">
        {subtypeDistribution.map((chart) => (
          <DistributionPieChart
            description={chart.description}
            items={withColors(chart.items)}
            key={chart.title}
            title={`Subtype ${chart.title.replace("Type ", "")}`}
            variant="small"
          />
        ))}
      </div>
    </article>
  );
}
