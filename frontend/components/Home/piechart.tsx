"use client";

import { ArcElement, Chart as ChartJS, Tooltip } from "chart.js";
import { Pie } from "react-chartjs-2";

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
        borderWidth: 2,
        data: items.map((item) => item.value),
        hoverOffset: 8,
      },
    ],
  };
}

export function DistributionPieChart({
  description,
  items,
  title,
  variant = "large",
}: {
  description?: string;
  items: PieDatum[];
  title: string;
  variant?: "large" | "small";
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const legendDensityClass =
    items.length >= 6
      ? styles.legendDense
      : items.length >= 4
        ? styles.legendCompact
        : "";

  return (
    <div className={`${styles.pieCard} ${variant === "large" ? styles.largePieCard : styles.smallPieCard}`}>
      <div className={styles.panelHeader}>
        <h3 className={styles.pieTitle}>{title}</h3>
        {description ? <p className={styles.panelText}>{description}</p> : null}
      </div>

      <div className={variant === "large" ? styles.largePieLayout : styles.smallPieLayout}>
        <div className={variant === "large" ? styles.largePieChart : styles.smallPieChart}>
          <Pie
            data={buildPieData(items)}
            options={{
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (context) => {
                      const value = Number(context.raw ?? 0);
                      const percent = Math.round((value / total) * 100);
                      return `${context.label}: ${value} (${percent}%)`;
                    },
                  },
                },
              },
            }}
          />
        </div>

        <div className={`${styles.legend} ${legendDensityClass}`}>
          {items.map((item) => (
            <div key={item.label} className={styles.legendItem}>
              <span className={styles.legendSwatch} style={{ backgroundColor: item.color }} />
              <span>{item.label}</span>
              <span className={styles.legendValue}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
