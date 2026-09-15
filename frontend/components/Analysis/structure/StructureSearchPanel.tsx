"use client";

import { Database, Download, FileUp, Search, X } from "lucide-react";

import {
  FOLDSEEK_DATABASES,
  type FoldseekHit,
  type FoldseekJobStatus,
  type FoldseekQuerySource,
} from "./api";
import styles from "@/css/Structure.module.css";

export type FoldseekUiStatus = "idle" | "submitting" | FoldseekJobStatus;

interface StructureSearchPanelProps {
  canSearchSequence: boolean;
  structureFiles: File[];
  querySource: FoldseekQuerySource;
  database: string;
  eValue: string;
  maxHits: number;
  status: FoldseekUiStatus;
  progress: number;
  stage: string;
  jobId?: string;
  hits: FoldseekHit[];
  selectedHit: FoldseekHit | null;
  error?: string | null;
  onQuerySourceChange: (source: FoldseekQuerySource) => void;
  onStructureFilesChange: (files: File[]) => void;
  onDatabaseChange: (database: string) => void;
  onEValueChange: (value: string) => void;
  onMaxHitsChange: (value: number) => void;
  onRun: () => void;
  onSelect: (hit: FoldseekHit) => void;
}

function downloadHits(hits: FoldseekHit[]) {
  const columns: (keyof FoldseekHit)[] = [
    "query",
    "target",
    "identity",
    "aligned_length",
    "query_start",
    "query_end",
    "target_start",
    "target_end",
    "evalue",
    "bit_score",
  ];
  const rows = hits.map((hit) => columns.map((column) => hit[column]).join("\t"));
  const blob = new Blob([[columns.join("\t"), ...rows].join("\n")], {
    type: "text/tab-separated-values;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "foldseek_hits.tsv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function StructureSearchPanel({
  canSearchSequence,
  structureFiles,
  querySource,
  database,
  eValue,
  maxHits,
  status,
  progress,
  stage,
  jobId,
  hits,
  selectedHit,
  error,
  onQuerySourceChange,
  onStructureFilesChange,
  onDatabaseChange,
  onEValueChange,
  onMaxHitsChange,
  onRun,
  onSelect,
}: StructureSearchPanelProps) {
  const running = status === "submitting" || status === "queued" || status === "running";
  const validEValue = Number.isFinite(Number(eValue)) && Number(eValue) > 0;
  const canRun = querySource === "structure"
    ? structureFiles.length > 0
    : canSearchSequence;
  const sourceDetail = querySource === "structure"
    ? structureFiles.length
      ? `${structureFiles.length} structure file${structureFiles.length === 1 ? "" : "s"}`
      : "Upload PDB or mmCIF files"
    : "Current FASTA input · ProstT5 3Di";

  return (
    <section className={styles.analysisCard} aria-labelledby="structure-search-title">
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.panelEyebrow}>Foldseek · real results</span>
          <h2 id="structure-search-title">Structure similarity search</h2>
          <p>Search from ProstT5-derived 3Di or directly from uploaded structures.</p>
        </div>
        <Database aria-hidden="true" size={22} />
      </div>

      <div className={styles.searchControls}>
        <label>
          <span>Query source</span>
          <select
            value={querySource}
            disabled={running}
            onChange={(event) => onQuerySourceChange(event.target.value as FoldseekQuerySource)}
          >
            <option value="sequence">Input sequence · ProstT5</option>
            <option value="structure">Input structure · PDB/mmCIF</option>
          </select>
        </label>
        <label>
          <span>Target database</span>
          <select
            value={database}
            disabled={running}
            onChange={(event) => onDatabaseChange(event.target.value)}
          >
            {FOLDSEEK_DATABASES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>E-value</span>
          <input
            type="text"
            inputMode="decimal"
            value={eValue}
            disabled={running}
            onChange={(event) => onEValueChange(event.target.value)}
            aria-invalid={!validEValue}
          />
        </label>
        <label>
          <span>Max hits</span>
          <select
            value={maxHits}
            disabled={running}
            onChange={(event) => onMaxHitsChange(Number(event.target.value))}
          >
            {[10, 30, 50, 100].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={!canRun || !validEValue || running}
          onClick={onRun}
        >
          {running
            ? <span className={styles.spinnerSmall} aria-hidden="true" />
            : <Search aria-hidden="true" size={16} />}
          {running ? "Searching…" : hits.length ? "Search again" : "Run Foldseek"}
        </button>
      </div>

      {querySource === "structure" && (
        <div className={styles.structureUpload}>
          <label className={styles.uploadButton}>
            <FileUp aria-hidden="true" size={16} />
            Upload PDB or mmCIF
            <input
              type="file"
              accept=".pdb,.cif,.mmcif,chemical/x-pdb,chemical/x-mmcif"
              multiple
              disabled={running}
              onChange={(event) => {
                onStructureFilesChange(Array.from(event.target.files ?? []).slice(0, 10));
                event.target.value = "";
              }}
            />
          </label>
          {structureFiles.length > 0 && (
            <div className={styles.fileChip}>
              <span title={structureFiles.map((file) => file.name).join(", ")}>
                {structureFiles.map((file) => file.name).join(", ")}
              </span>
              <button
                type="button"
                aria-label="Remove uploaded structures"
                disabled={running}
                onClick={() => onStructureFilesChange([])}
              >
                <X aria-hidden="true" size={14} />
              </button>
            </div>
          )}
          <small>Up to 10 files, 20 MB each.</small>
        </div>
      )}

      <div className={styles.searchSource}>
        <span>Query</span>
        <strong>{sourceDetail}</strong>
      </div>

      {running && (
        <div className={styles.searchProgress} aria-live="polite">
          <div>
            <span>{stage}</span>
            <strong>{Math.round(progress)}%</strong>
          </div>
          <div className={styles.progressTrack}>
            <span style={{ width: `${Math.max(progress, 4)}%` }} />
          </div>
          {jobId && <code>{jobId}</code>}
        </div>
      )}

      {error && <p className={styles.errorMessage} role="alert">{error}</p>}

      {hits.length > 0 ? (
        <>
          <div className={styles.resultSummary}>
            <span>{hits.length.toLocaleString()} Foldseek hits</span>
            <button type="button" className={styles.secondaryButton} onClick={() => downloadHits(hits)}>
              <Download aria-hidden="true" size={14} />
              Export TSV
            </button>
          </div>
          <div className={styles.resultTableWrap}>
            <table className={styles.resultTable}>
              <thead>
                <tr>
                  <th scope="col">Query</th>
                  <th scope="col">Target</th>
                  <th scope="col">Identity</th>
                  <th scope="col">Aligned</th>
                  <th scope="col">Query range</th>
                  <th scope="col">Target range</th>
                  <th scope="col">E-value</th>
                  <th scope="col">Bits</th>
                </tr>
              </thead>
              <tbody>
                {hits.map((hit) => {
                  const selected = selectedHit?.query === hit.query
                    && selectedHit.target === hit.target;
                  return (
                    <tr
                      key={`${hit.query}:${hit.target}`}
                      className={selected ? styles.selectedResult : undefined}
                    >
                      <td className={styles.monoCell}>{hit.query}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.targetButton}
                          onClick={() => onSelect(hit)}
                        >
                          <strong>{hit.target}</strong>
                          {hit.description && <span>{hit.description}</span>}
                        </button>
                      </td>
                      <td>{(hit.identity * 100).toFixed(1)}%</td>
                      <td>{hit.aligned_length}</td>
                      <td>{hit.query_start}–{hit.query_end}</td>
                      <td>{hit.target_start}–{hit.target_end}</td>
                      <td className={styles.monoCell}>{hit.evalue}</td>
                      <td>{hit.bit_score.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className={styles.emptyPanel} aria-live="polite">
          {running
            ? <span className={styles.spinner} aria-hidden="true" />
            : <Search aria-hidden="true" size={28} />}
          <strong>
            {running
              ? stage
              : status === "completed"
                ? "No similar structures passed the current thresholds"
                : canRun
                  ? "The query is ready for Foldseek"
                  : "Choose an available query source"}
          </strong>
          <span>
            {running
              ? "The job continues on the server; keep this page open to follow its status."
              : status === "completed"
                ? "Try another target database or adjust the search parameters later."
                : "Select a database and submit a background search job."}
          </span>
        </div>
      )}
    </section>
  );
}
