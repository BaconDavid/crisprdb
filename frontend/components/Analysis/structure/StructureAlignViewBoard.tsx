"use client";

import { GitCompareArrows } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  AsyncStatus,
  FoldseekHit,
  StructureAlignment,
  StructureModel,
} from "./api";
import {
  applyTransform,
  buildDemoPdb,
  load3Dmol,
  mainChainCA,
  superpose,
  type MolViewer,
} from "@/lib/structure";
import styles from "@/css/Structure.module.css";

interface StructureAlignViewBoardProps {
  model: StructureModel | null;
  target: FoldseekHit | null;
  status: AsyncStatus;
  alignment: StructureAlignment | null;
  error?: string | null;
  onRun: () => void;
}

function hashTarget(target: string) {
  let hash = 0;
  for (let index = 0; index < target.length; index += 1) {
    hash = (hash * 31 + target.charCodeAt(index)) % 99991;
  }
  return hash;
}

export function StructureAlignViewBoard({
  model,
  target,
  status,
  alignment,
  error,
  onRun,
}: StructureAlignViewBoardProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<MolViewer | null>(null);
  const [viewerError, setViewerError] = useState(false);

  const matchLine = useMemo(() => {
    if (!alignment) return "";
    return alignment.queryAlignment
      .split("")
      .map((residue, index) => residue === alignment.targetAlignment[index] ? "|" : " ")
      .join("");
  }, [alignment]);

  useEffect(() => {
    let active = true;
    if (!alignment || !model || !hostRef.current) return () => { active = false; };

    setViewerError(false);
    void load3Dmol().then((mol) => {
      if (!active || !mol || !hostRef.current) {
        if (active) setViewerError(true);
        return;
      }
      try {
        const viewer = viewerRef.current ?? mol.createViewer(hostRef.current, {
          backgroundColor: "#f8fafc",
          antialias: true,
        });
        viewerRef.current = viewer;
        viewer.clear();
        const queryModel = viewer.addModel(model.pdbText, "pdb");
        const targetModel = viewer.addModel(
          buildDemoPdb(hashTarget(alignment.target.target) % 3, alignment.targetLength),
          "pdb",
        );
        const queryAtoms = mainChainCA(queryModel);
        const targetAtoms = mainChainCA(targetModel);
        const fit = superpose(queryAtoms, targetAtoms);
        if (fit) applyTransform(targetModel, fit);
        viewer.setStyle({}, {});
        viewer.setStyle({ model: queryModel }, { cartoon: { color: "#2563eb", thickness: 0.44, arrows: true } });
        viewer.setStyle({ model: targetModel }, { cartoon: { color: "#f97316", thickness: 0.44, arrows: true } });
        viewer.zoomTo();
        viewer.render();
      } catch {
        if (active) setViewerError(true);
      }
    });

    return () => { active = false; };
  }, [alignment, model]);

  return (
    <section className={styles.analysisCard} aria-labelledby="structure-align-title">
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.panelEyebrow}>Pairwise comparison · simulated TM-align</span>
          <h2 id="structure-align-title">Structure alignment</h2>
          <p>Superpose the query model with the Foldseek hit selected above.</p>
        </div>
        <GitCompareArrows aria-hidden="true" size={22} />
      </div>

      <div className={styles.alignControls}>
        <div>
          <span>Selected target</span>
          <strong>{target?.target ?? "Choose a Foldseek result"}</strong>
          <small>{target?.description ?? "The first search hit is selected automatically."}</small>
        </div>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={!model || !target || status === "running"}
          onClick={onRun}
        >
          {status === "running" ? <span className={styles.spinnerSmall} aria-hidden="true" /> : <GitCompareArrows aria-hidden="true" size={16} />}
          {status === "running" ? "Aligning…" : alignment ? "Align again" : "Run alignment"}
        </button>
      </div>

      {error && <p className={styles.errorMessage} role="alert">{error}</p>}

      {alignment ? (
        <div className={styles.alignmentGrid}>
          <div className={styles.alignmentViewer}>
            <div ref={hostRef} className={styles.alignmentHost} />
            {viewerError && (
              <div className={styles.viewerOverlay}>
                <strong>The overlay viewer could not load</strong>
                <span>Alignment metrics are still available.</span>
              </div>
            )}
            <div className={styles.overlayLegend}>
              <span><i className={styles.querySwatch} />Query</span>
              <span><i className={styles.targetSwatch} />{alignment.target.target}</span>
            </div>
          </div>

          <div className={styles.alignmentDetails}>
            <dl className={styles.alignmentStats}>
              <div><dt>TM-score · query</dt><dd>{alignment.tmQuery.toFixed(3)}</dd></div>
              <div><dt>TM-score · target</dt><dd>{alignment.tmTarget.toFixed(3)}</dd></div>
              <div><dt>RMSD</dt><dd>{alignment.rmsd.toFixed(2)} Å</dd></div>
              <div><dt>Aligned residues</dt><dd>{alignment.alignedLength}</dd></div>
              <div><dt>Sequence identity</dt><dd>{(alignment.identity * 100).toFixed(1)}%</dd></div>
              <div><dt>Target length</dt><dd>{alignment.targetLength}</dd></div>
            </dl>
            <div className={styles.sequenceAlignment}>
              <span>Representative aligned segment</span>
              <pre>{`Query   ${alignment.queryAlignment}\n        ${matchLine}\nTarget  ${alignment.targetAlignment}`}</pre>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.emptyPanel}>
          <GitCompareArrows aria-hidden="true" size={28} />
          <strong>{target ? `${target.target} is ready to align` : "No target selected"}</strong>
          <span>{target ? "Run the simulated alignment to compare both folds." : "Search for similar structures and select a result."}</span>
        </div>
      )}
    </section>
  );
}
