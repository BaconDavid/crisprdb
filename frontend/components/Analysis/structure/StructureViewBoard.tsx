"use client";

import { Box, Download, Pause, Play, RotateCcw } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";

import type { StructureModel, StructureResult } from "./api";
import {
  caPlddtFromPdb,
  downloadPdbText,
  load3Dmol,
  normalizePlddt,
  PLDDT_LEGEND,
  plddtColor,
  type MolViewer,
} from "@/lib/structure";
import styles from "@/css/Structure.module.css";

type ViewerStyle = "cartoon" | "trace" | "stick" | "surface";

const VIEWER_STYLES: Array<{ id: ViewerStyle; label: string }> = [
  { id: "cartoon", label: "Cartoon" },
  { id: "trace", label: "Trace" },
  { id: "stick", label: "Sticks" },
  { id: "surface", label: "Surface" },
];

export function StructureViewBoard({
  model,
  results,
  onSelectResult,
}: {
  model: StructureModel | null;
  results: StructureResult[];
  onSelectResult: (result: StructureResult) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<MolViewer | null>(null);
  const [viewerStyle, setViewerStyle] = useState<ViewerStyle>("cartoon");
  const [spinning, setSpinning] = useState(false);
  const viewerStyleRef = useRef<ViewerStyle>(viewerStyle);
  const spinningRef = useRef(spinning);
  const [viewerStatus, setViewerStatus] = useState<"empty" | "loading" | "ready" | "error">("empty");
  const [hoveredResidue, setHoveredResidue] = useState<number | null>(null);
  const caPlddt = useMemo(
    () => (model ? caPlddtFromPdb(model.pdbText) : []),
    [model],
  );

  function updateHoveredResidue(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width === 0 || caPlddt.length === 0) return;

    // Position lookup stays accurate when long proteins make residues sub-pixel wide.
    const ratio = Math.min(0.999999, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    setHoveredResidue(Math.floor(ratio * caPlddt.length));
  }

  const applyViewerStyle = useCallback((viewer: MolViewer, style: ViewerStyle) => {
    const color = { colorfunc: (atom: { b: number }) => plddtColor(atom.b) };
    viewer.setStyle({}, {});
    viewer.removeAllSurfaces();
    if (style === "cartoon") {
      viewer.setStyle({}, { cartoon: { ...color, thickness: 0.5, arrows: true } });
    } else if (style === "trace") {
      viewer.setStyle({}, { cartoon: { ...color, style: "trace", thickness: 0.32 } });
    } else if (style === "stick") {
      viewer.setStyle({}, { stick: { ...color, radius: 0.13 }, sphere: { ...color, radius: 0.25 } });
    } else {
      viewer.setStyle({}, { cartoon: { ...color, thickness: 0.4 } });
      try {
        if (window.$3Dmol) {
          viewer.addSurface(window.$3Dmol.SurfaceType.MS, { ...color, opacity: 0.62 });
        }
      } catch {
        // Large surfaces can fail in WebGL; the cartoon remains visible.
      }
    }
    viewer.render();
  }, []);

  useEffect(() => {
    let active = true;
    if (!model || !hostRef.current) {
      setViewerStatus("empty");
      return () => {
        active = false;
      };
    }

    setViewerStatus("loading");
    void load3Dmol().then((mol) => {
      if (!active || !mol || !hostRef.current) {
        if (active) setViewerStatus("error");
        return;
      }
      try {
        const viewer = viewerRef.current ?? mol.createViewer(hostRef.current, {
          backgroundColor: "#f8fafc",
          antialias: true,
        });
        viewerRef.current = viewer;
        viewer.clear();
        viewer.addModel(model.pdbText, "pdb");
        applyViewerStyle(viewer, viewerStyleRef.current);
        viewer.zoomTo();
        viewer.spin(spinningRef.current ? "y" : false);
        viewer.render();
        if (active) setViewerStatus("ready");
      } catch {
        if (active) setViewerStatus("error");
      }
    });

    return () => {
      active = false;
    };
  }, [applyViewerStyle, model]);

  useEffect(() => {
    if (!viewerRef.current || viewerStatus !== "ready") return;
    viewerStyleRef.current = viewerStyle;
    applyViewerStyle(viewerRef.current, viewerStyle);
  }, [applyViewerStyle, viewerStatus, viewerStyle]);

  return (
    <section className={styles.viewerCard} aria-labelledby="structure-viewer-title">
      <div className={styles.viewerToolbar}>
        <div className={styles.viewerTitle}>
          <span className={styles.titleIcon}><Box aria-hidden="true" size={18} /></span>
          <div>
            <span className={styles.panelEyebrow}>Predicted model</span>
            <h2 id="structure-viewer-title">3D structure viewer</h2>
          </div>
          {model && <span className={styles.modelBadge}>ESMFold v1</span>}
        </div>

        <div className={styles.viewerActions}>
          {results.length > 1 && (
            <label className={styles.resultPicker}>
              <span>Model</span>
              <select
                className={styles.resultSelect}
                value={model?.resultIndex ?? ""}
                onChange={(event) => {
                  const result = results.find(
                    (item) => item.index === Number(event.target.value),
                  );
                  if (result) onSelectResult(result);
                }}
              >
                {model === null && <option value="">Loading…</option>}
                {results.map((result) => (
                  <option key={result.index} value={result.index}>
                    {result.query_id}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className={styles.segmentedControl} aria-label="Structure rendering style">
            {VIEWER_STYLES.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={viewerStyle === option.id}
                className={viewerStyle === option.id ? styles.segmentActive : ""}
                onClick={() => {
                  viewerStyleRef.current = option.id;
                  setViewerStyle(option.id);
                }}
                disabled={!model}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={spinning ? "Pause structure rotation" : "Rotate structure"}
            title={spinning ? "Pause rotation" : "Rotate structure"}
            disabled={!model}
            onClick={() => {
              const next = !spinning;
              spinningRef.current = next;
              setSpinning(next);
              viewerRef.current?.spin(next ? "y" : false);
              viewerRef.current?.render();
            }}
          >
            {spinning ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Reset structure view"
            title="Reset view"
            disabled={!model}
            onClick={() => {
              viewerRef.current?.zoomTo();
              viewerRef.current?.render();
            }}
          >
            <RotateCcw aria-hidden="true" size={16} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Download predicted PDB"
            title="Download PDB"
            disabled={!model}
            onClick={() => model && downloadPdbText(model.pdbText, `${model.title.replace(/[^A-Za-z0-9_.-]+/g, "_")}.pdb`)}
          >
            <Download aria-hidden="true" size={16} />
          </button>
        </div>
      </div>

      <div className={styles.viewerViewport}>
        <div ref={hostRef} className={styles.moleculeHost} />
        {viewerStatus !== "ready" && (
          <div className={styles.viewerOverlay} role="status">
            {viewerStatus === "loading" ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                <strong>Rendering the ESMFold model…</strong>
                <span>Loading the interactive 3D viewer</span>
              </>
            ) : viewerStatus === "error" ? (
              <>
                <Box aria-hidden="true" size={34} />
                <strong>The 3D viewer could not load</strong>
                <span>The predicted PDB is still available to download.</span>
              </>
            ) : (
              <>
                <Box aria-hidden="true" size={42} />
                <strong>No predicted model yet</strong>
                <span>Submit a prediction job to inspect the fold.</span>
              </>
            )}
          </div>
        )}

        {viewerStatus === "ready" && (
          <div className={styles.confidenceLegend}>
            <span>pLDDT confidence</span>
            <div>
              {PLDDT_LEGEND.map(([color, label]) => (
                <span key={label}>
                  <i style={{ backgroundColor: color }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <dl className={styles.modelStats}>
        <div><dt>Engine</dt><dd>{model ? "ESMFold v1" : "—"}</dd></div>
        <div><dt>Mean pLDDT</dt><dd>{model ? normalizePlddt(model.meanPlddt).toFixed(1) : "—"}</dd></div>
        <div><dt>pTM score</dt><dd>{model ? model.ptm.toFixed(2) : "—"}</dd></div>
        <div><dt>Residues</dt><dd>{model?.sequenceLength.toLocaleString() ?? "—"}</dd></div>
      </dl>

      {model && caPlddt.length > 0 && (
        <div className={styles.plddtTrackSection}>
          <div className={styles.plddtTrackHeader}>
            <strong>Per-residue confidence (Cα pLDDT)</strong>
            <span>Residue 1 – {caPlddt.length.toLocaleString()}</span>
          </div>
          <div className={styles.plddtTrackWrap}>
            <div
              className={styles.plddtTrack}
              role="img"
              aria-label={`C-alpha pLDDT confidence for ${caPlddt.length} residues`}
              onPointerEnter={updateHoveredResidue}
              onPointerMove={updateHoveredResidue}
              onPointerLeave={() => setHoveredResidue(null)}
            >
              {caPlddt.map((score, index) => (
                <span
                  key={index}
                  aria-hidden="true"
                  style={{ backgroundColor: plddtColor(score) }}
                />
              ))}
            </div>
            {hoveredResidue !== null && (
              <span
                className={styles.plddtTooltip}
                role="tooltip"
                style={{
                  left: `${Math.min(93, Math.max(7, ((hoveredResidue + 0.5) / caPlddt.length) * 100))}%`,
                }}
              >
                Residue {hoveredResidue + 1} · Cα pLDDT {caPlddt[hoveredResidue].toFixed(1)}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
