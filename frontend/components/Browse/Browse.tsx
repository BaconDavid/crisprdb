"use client";

import { useState } from "react";

import { CasOperonBrowse } from "./CasOperonBrowse";
import { GenomeBrowse } from "./GenomeBrowse";
import { ProteinBrowse } from "./ProteinBrowse";
import { useI18n } from "@/components/I18nProvider";
import styles from "@/css/Browse.module.css";

export type BrowseEntity = "operon" | "protein" | "genome";

export function Browse({ initialEntity = "operon" }: { initialEntity?: BrowseEntity }) {
  const [entity, setEntity] = useState<BrowseEntity>(initialEntity);
  const { messages } = useI18n();
  const copy = messages.browse.pages[entity];

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>{messages.browse.eyebrow}</p>
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
            {messages.browse.tabs.operon}
          </button>
          <button
            type="button"
            className={entity === "protein" ? styles.activeEntityTab : undefined}
            aria-pressed={entity === "protein"}
            onClick={() => setEntity("protein")}
          >
            {messages.browse.tabs.protein}
          </button>
          <button
            type="button"
            className={entity === "genome" ? styles.activeEntityTab : undefined}
            aria-pressed={entity === "genome"}
            onClick={() => setEntity("genome")}
          >
            {messages.browse.tabs.genome}
          </button>
        </div>
      </header>

      {entity === "operon" ? (
        <CasOperonBrowse />
      ) : entity === "protein" ? (
        <ProteinBrowse />
      ) : (
        <GenomeBrowse />
      )}
    </main>
  );
}
