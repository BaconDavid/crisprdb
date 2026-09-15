"use client";

import { FileUp, FlaskConical, Play, RotateCcw, X } from "lucide-react";

import { cleanSequence, type StructureJobStatus } from "./api";
import styles from "@/css/Structure.module.css";

export type PredictionUiStatus = StructureJobStatus | "idle" | "submitting";

interface StructurePredictPanelProps {
  sequence: string;
  recycles: number;
  status: PredictionUiStatus;
  progress: number;
  stage: string;
  jobId?: string;
  fileName?: string;
  sourceLabel?: string;
  sourceLoading?: boolean;
  error?: string | null;
  onSequenceChange: (sequence: string) => void;
  onFileSelect: (file: File | null) => void;
  onRecyclesChange: (recycles: number) => void;
  onRun: () => void;
  onReset: () => void;
}

export function StructurePredictPanel({
  sequence,
  recycles,
  status,
  progress,
  stage,
  jobId,
  fileName,
  sourceLabel,
  sourceLoading = false,
  error,
  onSequenceChange,
  onFileSelect,
  onRecyclesChange,
  onRun,
  onReset,
}: StructurePredictPanelProps) {
  const sequenceLength = cleanSequence(sequence).length;
  const busy = ["submitting", "queued", "running"].includes(status);

  return (
    <aside className={styles.predictPanel} aria-label="Structure prediction controls">
      <div className={styles.panelHeading}>
        <div>
          <span className={styles.panelEyebrow}>Prediction input</span>
          <h2>Build a structure</h2>
        </div>
        <FlaskConical aria-hidden="true" size={20} />
      </div>

      {sourceLabel && (
        <div className={styles.sourceNotice}>
          <span>Loaded from Browse</span>
          <strong>{sourceLabel}</strong>
          {sourceLoading && <span className={styles.spinnerSmall} aria-hidden="true" />}
        </div>
      )}

      <div className={styles.uploadBlock}>
        <label className={styles.uploadButton}>
          <FileUp aria-hidden="true" size={16} />
          Upload FASTA
          <input
            type="file"
            accept=".fa,.fasta,.faa,text/plain"
            disabled={busy || sourceLoading}
            onChange={(event) => {
              onFileSelect(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
        </label>
        {fileName && (
          <div className={styles.fileChip}>
            <span title={fileName}>{fileName}</span>
            <button
              type="button"
              aria-label="Remove uploaded FASTA"
              disabled={busy}
              onClick={() => onFileSelect(null)}
            >
              <X aria-hidden="true" size={14} />
            </button>
          </div>
        )}
      </div>

      <div className={styles.inputDivider}><span>or paste a sequence / FASTA</span></div>

      <div className={styles.fieldGroup}>
        <div className={styles.fieldLabelRow}>
          <label htmlFor="structure-sequence">Query sequence</label>
          <span>{sequenceLength.toLocaleString()} residues</span>
        </div>
        <textarea
          id="structure-sequence"
          className={styles.sequenceInput}
          value={sequence}
          onChange={(event) => onSequenceChange(event.target.value)}
          spellCheck={false}
          aria-describedby="structure-sequence-hint"
          disabled={busy || sourceLoading}
        />
        <p id="structure-sequence-hint" className={styles.fieldHint}>
          Raw amino acids or FASTA; up to 10 proteins and 1,500 residues per protein.
        </p>
      </div>

      <div className={styles.fixedModel}>
        <span>Prediction model</span>
        <strong>ESMFold v1</strong>
        <small>GPU inference · one queued job at a time</small>
      </div>

      <div className={styles.fieldGroup}>
        <label htmlFor="structure-recycles">Recycles</label>
        <input
          id="structure-recycles"
          className={styles.numberInput}
          type="number"
          min={1}
          max={12}
          inputMode="numeric"
          value={recycles}
          disabled={busy || sourceLoading}
          onChange={(event) => {
            const next = Number(event.target.value);
            onRecyclesChange(Math.max(1, Math.min(12, Number.isFinite(next) ? Math.floor(next) : 1)));
          }}
        />
      </div>

      <div className={styles.predictActions}>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={busy || sourceLoading || sequenceLength < 1}
          onClick={onRun}
        >
          {busy ? <span className={styles.spinnerOnDark} aria-hidden="true" /> : <Play aria-hidden="true" size={16} fill="currentColor" />}
          {busy ? "Prediction running…" : status === "completed" ? "Run another job" : "Predict structure"}
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onReset}
          disabled={busy || sourceLoading}
          aria-label="Reset prediction input"
          title="Reset input"
        >
          <RotateCcw aria-hidden="true" size={16} />
        </button>
      </div>

      {busy && (
        <div className={styles.progressBlock} role="status" aria-live="polite">
          <div className={styles.progressMeta}>
            <span>{stage}</span>
            <strong>{progress}%</strong>
          </div>
          <div className={styles.progressTrack}>
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {jobId && (
        <div className={styles.jobId}>
          <span>Job ID</span>
          <code>{jobId}</code>
        </div>
      )}

      {error && <p className={styles.errorMessage} role="alert">{error}</p>}
    </aside>
  );
}
