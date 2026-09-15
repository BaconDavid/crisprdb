"use client";

import { ArrowLeft, Box } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { fetchCasProtein } from "@/components/Browse/api";
import { StructurePredictPanel, type PredictionUiStatus } from "./StructurePredictPanel";
import { StructureSearchPanel, type FoldseekUiStatus } from "./StructureSearchPanel";
import { StructureViewBoard } from "./StructureViewBoard";
import {
  cleanSequence,
  createFoldseekSequenceTextJob,
  createFoldseekSequenceUploadJob,
  createFoldseekStructureUploadJob,
  createStructureTextJob,
  createStructureUploadJob,
  DEFAULT_SEQUENCE,
  fetchFoldseekJob,
  fetchFoldseekResults,
  fetchStructureJob,
  fetchStructurePdb,
  fetchStructureResults,
  FOLDSEEK_DATABASES,
  formatFasta,
  type FoldseekHit,
  type FoldseekJob,
  type FoldseekQuerySource,
  type StructureModel,
  type StructureResult,
} from "./api";
import styles from "@/css/Structure.module.css";

const ANNOTATION_SOURCE = "cctyper";
const POLL_INTERVAL_MS = 2_000;

function messageFor(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function waitForPoll(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const handleAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, POLL_INTERVAL_MS);
    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

function foldseekStageFor(job: FoldseekJob) {
  if (job.status === "queued") return "Waiting for the Foldseek worker";
  if (job.stage === "creating_query_db") return "Creating the Foldseek query database";
  if (job.stage === "searching") return "Searching the target structure database";
  return "Running Foldseek";
}

export function StructureWorkbench({ proteinHeader }: { proteinHeader?: string }) {
  const [sequence, setSequence] = useState(DEFAULT_SEQUENCE);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [sourceLabel, setSourceLabel] = useState(proteinHeader);
  const [sourceLoading, setSourceLoading] = useState(Boolean(proteinHeader));
  const [sourceWarning, setSourceWarning] = useState<string | null>(null);
  const [recycles, setRecycles] = useState(4);

  const [status, setStatus] = useState<PredictionUiStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("Ready to submit");
  const [jobId, setJobId] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<StructureResult[]>([]);
  const [model, setModel] = useState<StructureModel | null>(null);
  const requestController = useRef<AbortController | null>(null);

  const [foldseekSource, setFoldseekSource] = useState<FoldseekQuerySource>("sequence");
  const [foldseekDatabase, setFoldseekDatabase] = useState<string>(
    FOLDSEEK_DATABASES[0].value,
  );
  const [foldseekStructureFiles, setFoldseekStructureFiles] = useState<File[]>([]);
  const [foldseekEValue, setFoldseekEValue] = useState("0.001");
  const [foldseekMaxHits, setFoldseekMaxHits] = useState(100);
  const [foldseekStatus, setFoldseekStatus] = useState<FoldseekUiStatus>("idle");
  const [foldseekProgress, setFoldseekProgress] = useState(0);
  const [foldseekStage, setFoldseekStage] = useState("Ready to submit");
  const [foldseekJobId, setFoldseekJobId] = useState<string>();
  const [foldseekHits, setFoldseekHits] = useState<FoldseekHit[]>([]);
  const [selectedHit, setSelectedHit] = useState<FoldseekHit | null>(null);
  const [foldseekError, setFoldseekError] = useState<string | null>(null);
  const foldseekController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!proteinHeader) return;
    const controller = new AbortController();
    fetchCasProtein(proteinHeader, ANNOTATION_SOURCE, controller.signal)
      .then((protein) => {
        setSequence(formatFasta(protein.sequence, protein.protein_header));
        setSourceLabel(protein.protein_header);
        setSourceWarning(null);
      })
      .catch((requestError: Error) => {
        if (requestError.name !== "AbortError") {
          setSourceWarning("Browse data could not be loaded, so the demo sequence is shown instead.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSourceLoading(false);
      });
    return () => controller.abort();
  }, [proteinHeader]);

  useEffect(() => () => {
    requestController.current?.abort();
    foldseekController.current?.abort();
  }, []);

  function resetFoldseekSearch() {
    foldseekController.current?.abort();
    setFoldseekStatus("idle");
    setFoldseekProgress(0);
    setFoldseekStage("Ready to submit");
    setFoldseekJobId(undefined);
    setFoldseekHits([]);
    setSelectedHit(null);
    setFoldseekError(null);
  }

  async function loadResult(job: string, result: StructureResult, signal: AbortSignal) {
    setModel(null);
    const pdbText = await fetchStructurePdb(job, result.index, signal);
    setModel({
      jobId: job,
      resultIndex: result.index,
      title: result.query_id,
      engine: "esmfold_v1",
      sequenceLength: result.sequence_length,
      pdbText,
      meanPlddt: result.mean_plddt,
      ptm: result.ptm,
    });
  }

  async function runPrediction() {
    requestController.current?.abort();
    resetFoldseekSearch();
    const controller = new AbortController();
    requestController.current = controller;
    setStatus("submitting");
    setProgress(0);
    setStage("Creating prediction job");
    setJobId(undefined);
    setError(null);
    setResults([]);
    setModel(null);

    try {
      const created = uploadedFile
        ? await createStructureUploadJob(uploadedFile, recycles, controller.signal)
        : await createStructureTextJob(sequence, recycles, controller.signal);
      setJobId(created.job_id);
      setStatus(created.status);
      setStage("Waiting for the ESMFold worker");

      let job = created;
      while (job.status === "queued" || job.status === "running") {
        await waitForPoll(controller.signal);
        job = await fetchStructureJob(job.job_id, controller.signal);
        setStatus(job.status);
        setProgress(job.progress);
        setStage(
          job.status === "queued"
            ? "Waiting for the ESMFold worker"
            : `Predicting ${job.current_query ?? "protein"} · ${job.completed_count}/${job.query_count} complete`,
        );
      }

      if (job.status === "failed") {
        throw new Error(job.error ?? "ESMFold prediction failed.");
      }

      const completed = await fetchStructureResults(job.job_id, controller.signal);
      if (completed.structures.length === 0) {
        throw new Error("The job completed without a structure result.");
      }
      setResults(completed.structures);
      setStatus("completed");
      setProgress(100);
      setStage("Prediction complete");
      await loadResult(job.job_id, completed.structures[0], controller.signal);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === "AbortError") return;
      setStatus("failed");
      setError(messageFor(requestError, "Structure prediction failed. Please try again."));
    }
  }

  async function selectResult(result: StructureResult) {
    if (!jobId || result.index === model?.resultIndex) return;
    if (foldseekSource === "prediction") resetFoldseekSearch();
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setError(null);
    try {
      await loadResult(jobId, result, controller.signal);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === "AbortError") return;
      setError(messageFor(requestError, "Unable to load this predicted structure."));
    }
  }

  async function selectFile(file: File | null) {
    if (foldseekSource === "sequence") resetFoldseekSearch();
    setUploadedFile(file);
    if (!file) return;
    setError(null);
    try {
      setSequence(await file.text());
      setSourceLabel(undefined);
    } catch (fileError) {
      setUploadedFile(null);
      setError(messageFor(fileError, "Unable to read the FASTA file."));
    }
  }

  async function runFoldseek() {
    foldseekController.current?.abort();
    const controller = new AbortController();
    foldseekController.current = controller;
    setFoldseekStatus("submitting");
    setFoldseekProgress(0);
    setFoldseekStage("Creating Foldseek job");
    setFoldseekJobId(undefined);
    setFoldseekHits([]);
    setSelectedHit(null);
    setFoldseekError(null);

    try {
      const eValue = Number(foldseekEValue);
      if (!Number.isFinite(eValue) || eValue <= 0) {
        throw new Error("E-value must be greater than zero.");
      }

      // Sequence queries use ProstT5 3Di. Uploaded structures are converted
      // into a Foldseek query database directly by the backend.
      const created = foldseekSource === "structure"
        ? foldseekStructureFiles.length
          ? await createFoldseekStructureUploadJob(
              foldseekStructureFiles,
              foldseekDatabase,
              eValue,
              foldseekMaxHits,
              controller.signal,
            )
          : null
        : uploadedFile
          ? await createFoldseekSequenceUploadJob(
              uploadedFile,
              foldseekDatabase,
              eValue,
              foldseekMaxHits,
              controller.signal,
            )
          : await createFoldseekSequenceTextJob(
              sequence,
              foldseekDatabase,
              eValue,
              foldseekMaxHits,
              controller.signal,
            );

      if (!created) throw new Error("Upload at least one PDB or mmCIF structure.");
      setFoldseekJobId(created.job_id);
      setFoldseekStatus(created.status);
      setFoldseekStage(foldseekStageFor(created));

      let job = created;
      while (job.status === "queued" || job.status === "running") {
        await waitForPoll(controller.signal);
        job = await fetchFoldseekJob(job.job_id, controller.signal);
        setFoldseekStatus(job.status);
        setFoldseekProgress(job.progress);
        setFoldseekStage(foldseekStageFor(job));
      }

      if (job.status === "failed") {
        throw new Error(job.error ?? "Foldseek search failed.");
      }

      const completed = await fetchFoldseekResults(job.job_id, controller.signal);
      setFoldseekStatus("completed");
      setFoldseekProgress(100);
      setFoldseekStage("Foldseek search complete");
      setFoldseekHits(completed.hits);
      setSelectedHit(completed.hits[0] ?? null);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === "AbortError") return;
      setFoldseekStatus("failed");
      setFoldseekStage("Foldseek search failed");
      setFoldseekError(messageFor(requestError, "Foldseek search failed. Please try again."));
    }
  }

  function resetInput() {
    requestController.current?.abort();
    resetFoldseekSearch();
    setSequence(DEFAULT_SEQUENCE);
    setUploadedFile(null);
    setSourceLabel(undefined);
    setSourceWarning(null);
    setStatus("idle");
    setProgress(0);
    setStage("Ready to submit");
    setJobId(undefined);
    setError(null);
    setResults([]);
    setModel(null);
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <Link href="/Browse?entity=protein" className={styles.backLink}>
            <ArrowLeft aria-hidden="true" size={15} />
            Browse proteins
          </Link>
          <p className={styles.pageEyebrow}>Analysis · Structure</p>
          <h1>Structure Prediction &amp; Foldseek</h1>
          <p className={styles.pageDescription}>
            Predict protein structures with ESMFold, or search Foldseek directly from sequence-derived 3Di and completed PDB models.
          </p>
        </div>
        <div className={styles.workflowSummary} aria-label="Structure workflow">
          <span><Box aria-hidden="true" size={15} />Submit job</span>
          <i />
          <span>Poll status</span>
          <i />
          <span>View PDB</span>
          <i />
          <span>Search folds</span>
          <strong>ESMFold v1</strong>
        </div>
      </header>

      {sourceWarning && <p className={styles.warningMessage} role="status">{sourceWarning}</p>}

      <div className={styles.workbenchGrid}>
        <StructurePredictPanel
          sequence={sequence}
          recycles={recycles}
          status={status}
          progress={progress}
          stage={stage}
          jobId={jobId}
          fileName={uploadedFile?.name}
          sourceLabel={sourceLabel}
          sourceLoading={sourceLoading}
          error={error}
          onSequenceChange={(value) => {
            if (foldseekSource === "sequence") resetFoldseekSearch();
            setSequence(value);
            setUploadedFile(null);
          }}
          onFileSelect={(file) => void selectFile(file)}
          onRecyclesChange={setRecycles}
          onRun={() => void runPrediction()}
          onReset={resetInput}
        />

        <div className={styles.workbenchMain}>
          <StructureViewBoard
            model={model}
            results={results}
            onSelectResult={(result) => void selectResult(result)}
          />
          <StructureSearchPanel
            canSearchSequence={Boolean(uploadedFile || cleanSequence(sequence))}
            structureFiles={foldseekStructureFiles}
            querySource={foldseekSource}
            database={foldseekDatabase}
            eValue={foldseekEValue}
            maxHits={foldseekMaxHits}
            status={foldseekStatus}
            progress={foldseekProgress}
            stage={foldseekStage}
            jobId={foldseekJobId}
            hits={foldseekHits}
            selectedHit={selectedHit}
            error={foldseekError}
            onQuerySourceChange={(source) => {
              resetFoldseekSearch();
              setFoldseekSource(source);
            }}
            onStructureFilesChange={(files) => {
              resetFoldseekSearch();
              setFoldseekStructureFiles(files);
            }}
            onDatabaseChange={(database) => {
              resetFoldseekSearch();
              setFoldseekDatabase(database);
            }}
            onEValueChange={(value) => {
              resetFoldseekSearch();
              setFoldseekEValue(value);
            }}
            onMaxHitsChange={(value) => {
              resetFoldseekSearch();
              setFoldseekMaxHits(value);
            }}
            onRun={() => void runFoldseek()}
            onSelect={setSelectedHit}
          />
        </div>
      </div>
    </main>
  );
}
