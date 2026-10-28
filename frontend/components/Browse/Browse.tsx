"use client";

import { useState } from "react";
import { Database } from "lucide-react";

import { CasOperonBrowse } from "./CasOperonBrowse";
import { GenomeBrowse } from "./GenomeBrowse";
import { ProteinBrowse } from "./ProteinBrowse";
import { useI18n } from "@/components/I18nProvider";
import { SelectControl } from "@/components/ui/SelectControl";
import styles from "@/css/Browse.module.css";

export type BrowseEntity = "operon" | "protein" | "genome";

export function Browse({
  initialEntity = "operon",
  initialProteinHeader,
}: {
  initialEntity?: BrowseEntity;
  initialProteinHeader?: string;
}) {
  const [entity, setEntity] = useState<BrowseEntity>(initialEntity);
  const { messages } = useI18n();
  const copy = messages.browse.pages[entity];
  const entitySelector = (
    <div className={styles.entitySelector}>
      <span className={styles.entitySelectorIcon} aria-hidden="true">
        <Database size={18} />
      </span>
      <span className={styles.entitySelectorText}>
        <small>Browse view</small>
        <strong>{copy.title}</strong>
      </span>
      <SelectControl
        value={entity}
        ariaLabel="Browse entity"
        controlSize="large"
        fullWidth
        variant="accent"
        options={[
          {
            value: "operon",
            label: messages.browse.tabs.operon,
            iconSrc: "/icons/operon.svg",
          },
          {
            value: "protein",
            label: messages.browse.tabs.protein,
            iconSrc: "/icons/protein.svg",
          },
          {
            value: "genome",
            label: messages.browse.tabs.genome,
            iconSrc: "/icons/genome.svg",
          },
        ]}
        onValueChange={(nextEntity) => setEntity(nextEntity as BrowseEntity)}
      />
    </div>
  );

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>{messages.browse.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className={styles.description}>{copy.description}</p>
        </div>
      </header>

      {entity === "operon" ? (
        <CasOperonBrowse toolbarLeading={entitySelector} />
      ) : entity === "protein" ? (
        <ProteinBrowse
          initialProteinHeader={initialProteinHeader}
          toolbarLeading={entitySelector}
        />
      ) : (
        <GenomeBrowse toolbarLeading={entitySelector} />
      )}
    </main>
  );
}
