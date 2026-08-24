"use client";

import { useState } from "react";

import { CasOperonBrowse } from "./CasOperonBrowse";
import { ProteinBrowse } from "./ProteinBrowse";
import styles from "@/css/Browse.module.css";

type BrowseEntity = "operon" | "protein";

const PAGE_COPY = {
  operon: {
    title: "Cas Operons",
    description: "Filter Cas operons by system classification, sample metadata and taxonomy. Expand any operon to inspect its gene architecture.",
  },
  protein: {
    title: "CRISPR-associated Proteins",
    description: "Browse CRISPR proteins by their selected HMM annotation, Cas operon type, sample metadata and taxonomy.",
  },
};

export function Browse() {
  const [entity, setEntity] = useState<BrowseEntity>("operon");
  const copy = PAGE_COPY[entity];

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Browse the database</p>
          <h1>{copy.title}</h1>
          <p className={styles.description}>{copy.description}</p>
        </div>
        <div className={styles.entityTabs} aria-label="Browse entity">
          <button
            type="button"
            className={entity === "operon" ? styles.activeEntityTab : undefined}
            aria-pressed={entity === "operon"}
            onClick={() => setEntity("operon")}
          >
            Cas Operon
          </button>
          <button
            type="button"
            className={entity === "protein" ? styles.activeEntityTab : undefined}
            aria-pressed={entity === "protein"}
            onClick={() => setEntity("protein")}
          >
            Protein
          </button>
          <button type="button" disabled title="Genome browsing will be added next">
            Genome (Contig)
          </button>
        </div>
      </header>

      {entity === "operon" ? <CasOperonBrowse /> : <ProteinBrowse />}
    </main>
  );
}
