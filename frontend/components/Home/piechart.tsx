"use client";

import { ArcElement, Chart as ChartJS, Tooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";

import styles from "@/css/HomeDashboard.module.css";

ChartJS.register(ArcElement, Tooltip);

type PieDatum = {
  color: string;
  label: string;
  value: number;
};

function buildPieData(items: PieDatum[]) {
  return {
    labels: items.map((item) => item.label),
    datasets: [
      {
        backgroundColor: items.map((item) => item.color),
        borderColor: "#ffffff",
        borderRadius: 7,
        borderWidth: 3,
        data: items.map((item) => item.value),
        hoverBorderWidth: 3,
        hoverOffset: 6,
        spacing: 2,
      },
    ],
  };
}

export function DistributionPieChart({
  description,
  items,
  legendLayout = "list",
  title,
  variant = "large",
}: {
  description?: string;
  items: PieDatum[];
  legendLayout?: "grid" | "list";
  title: string;
  variant?: "large" | "compact" | "mini";
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const layoutClass =
    variant === "compact"
      ? styles.compactDoughnutLayout
      : variant === "mini"
        ? styles.miniDoughnutLayout
        : styles.largeDoughnutLayout;
  const chartClass =
    variant === "compact"
      ? styles.compactDoughnutChart
      : variant === "mini"
        ? styles.miniDoughnutChart
        : styles.largeDoughnutChart;

  return (
    <section
      className={`${styles.pieCard} ${variant === "compact" ? styles.compactPieCard : ""} ${variant === "mini" ? styles.miniPieCard : ""}`}
    >
      <div className={styles.pieCardHeader}>
        <h3 className={styles.pieTitle}>{title}</h3>
        {description ? <p className={styles.pieDescription}>{description}</p> : null}
      </div>

      <div className={layoutClass}>
        <div className={`${styles.doughnutChart} ${chartClass}`}>
          <Doughnut
            data={buildPieData(items)}
            options={{
              animation: { duration: 450 },
              cutout: "67%",
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  backgroundColor: "#0f172a",
                  bodyFont: { size: 13, weight: 600 },
                  callbacks: {
                    label: (context) => {
                      const value = Number(context.raw ?? 0);
                      const percent = total > 0 ? Math.round((value / total) * 100) : 0;
                      return ` ${context.label}: ${value.toLocaleString()} (${percent}%)`;
                    },
                  },
                  cornerRadius: 8,
                  displayColors: true,
                  padding: 12,
                  titleFont: { size: 13, weight: 700 },
                },
              },
            }}
          />
          <div aria-hidden="true" className={styles.doughnutCenter}>
            <strong>{total.toLocaleString()}</strong>
            <span>operons</span>
          </div>
        </div>

        <div className={`${styles.legend} ${legendLayout === "grid" ? styles.horizontalLegend : ""}`}>
          {items.map((item) => {
            const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;

            return (
              <div key={item.label} className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ backgroundColor: item.color }} />
                <span className={styles.legendLabel}>{item.label}</span>
                <span className={styles.legendPercent}>{percent}%</span>
                <span className={styles.legendValue}>{item.value.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
