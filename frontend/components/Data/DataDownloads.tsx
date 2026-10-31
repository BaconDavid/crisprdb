"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";

import { useI18n } from "@/components/I18nProvider";
import {
  fetchAvailableData,
  getDownloadUrl,
  type AvailableData,
} from "@/components/Data/api";
import styles from "@/css/Data.module.css";

export function DataDownloads() {
  const { messages } = useI18n();
  const text = messages.data;
  const [datasets, setDatasets] = useState<AvailableData[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();

    fetchAvailableData(controller.signal)
      .then((availableData) => {
        setDatasets(availableData);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      });

    return () => controller.abort();
  }, []);

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>{text.eyebrow}</p>
        <h1>{text.title}</h1>
        <p className={styles.description}>{text.description}</p>
      </header>

      <section className={styles.content} aria-labelledby="data-table-title">
        <h2 id="data-table-title" className={styles.srOnly}>
          {text.title}
        </h2>

        {status === "loading" && (
          <div className={styles.status} role="status">
            {text.loading}
          </div>
        )}

        {status === "error" && (
          <div className={`${styles.status} ${styles.error}`} role="alert">
            {text.error}
          </div>
        )}

        {status === "ready" && datasets.length === 0 && (
          <div className={styles.status}>{text.empty}</div>
        )}

        {status === "ready" && datasets.length > 0 && (
          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{text.columns.title}</th>
                    <th scope="col">{text.columns.description}</th>
                    <th scope="col">{text.columns.source}</th>
                    <th scope="col">{text.columns.version}</th>
                    <th scope="col" className={styles.actionColumn}>
                      {text.columns.download}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {datasets.map((dataset) => {
                    const downloadUrl = getDownloadUrl(dataset.data_name);

                    return (
                      <tr key={dataset.data_name}>
                        <td>
                          <a className={styles.titleLink} href={downloadUrl} download>
                            {dataset.title}
                          </a>
                          <span className={styles.fileName}>{dataset.data_name}</span>
                        </td>
                        <td className={styles.descriptionCell}>{dataset.description}</td>
                        <td>{dataset.source ?? "—"}</td>
                        <td>{dataset.version}</td>
                        <td className={styles.actionCell}>
                          <a
                            className={styles.downloadButton}
                            href={downloadUrl}
                            download
                            aria-label={`${text.download}: ${dataset.title}`}
                          >
                            <Download aria-hidden="true" size={17} strokeWidth={2} />
                            {text.download}
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
