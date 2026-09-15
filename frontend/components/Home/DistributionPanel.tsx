import { DistributionPieChart } from "@/components/Home/piechart";
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

const subtypeColorsByType: Record<string, string[]> = {
  I: ["#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"],
  II: ["#c2410c", "#ea580c", "#f97316", "#fb923c", "#fdba74", "#fed7aa"],
  III: ["#047857", "#059669", "#10b981", "#34d399", "#6ee7b7", "#a7f3d0"],
  IV: ["#6d28d9", "#7c3aed", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe"],
  V: ["#be185d", "#db2777", "#ec4899", "#f472b6", "#f9a8d4", "#fbcfe8"],
  VI: ["#a16207", "#ca8a04", "#eab308", "#facc15", "#fde047", "#fef08a"],
};

const colorByLabel: Record<string, string> = {
  "Class 1": "#2563eb",
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

function withSubtypeColors(items: DistributionDatum[], typeTitle: string): PieDatum[] {
  const typeName = typeTitle.replace(/^Type\s+/i, "");
  const palette = subtypeColorsByType[typeName] ?? fallbackColors;

  return items.map((item, index) => ({
    ...item,
    color: palette[index % palette.length],
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
    <>
      <article className={`${styles.panel} ${styles.overviewDistributionCard}`}>
        <div className={styles.distributionCardHeader}>
          <h2 className={styles.distributionCardTitle}>Class &amp; type distribution</h2>
          <p className={styles.panelText}>
            Overall CRISPR-Cas composition across all annotated operons.
          </p>
        </div>

        <div className={styles.overviewChartGrid}>
          <DistributionPieChart
            items={withColors(classDistribution)}
            title="Class"
            variant="compact"
          />
          <DistributionPieChart
            items={withColors(typeDistribution)}
            legendLayout="grid"
            title="Type"
            variant="compact"
          />
        </div>
      </article>

      <article className={`${styles.panel} ${styles.subtypeDistributionCard}`}>
        <div className={styles.distributionCardHeader}>
          <h2 className={styles.distributionCardTitle}>Subtype distribution</h2>
          <p className={styles.panelText}>Subtype composition grouped by CRISPR type.</p>
        </div>

        <div className={styles.subtypeChartGrid} aria-label="Subtype distributions by CRISPR type">
          {subtypeDistribution.map((chart) => (
            <DistributionPieChart
              items={withSubtypeColors(chart.items, chart.title)}
              key={chart.title}
              title={chart.title}
              variant="mini"
            />
          ))}
        </div>
      </article>
    </>
  );
}
