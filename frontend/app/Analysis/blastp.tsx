"use client";

import { useState } from "react";
import { Play } from "lucide-react";

import { Navigation } from "@/components/Home/Navigation";
import {
  fetchAlignment,
  fetchResults,
  submitFile,
  submitText,
} from "@/components/Analysis/blastp/api";
import { BlastpResult } from "@/components/Analysis/blastp/BlastpResult";
import { Parameters } from "@/components/Analysis/blastp/Parameters";
import { SequenceInput } from "@/components/Analysis/blastp/SequenceInput";
import type {
  BlastpJob,
  BlastpParameters,
  BlastpResults,
  InputMode,
} from "@/components/Analysis/blastp/types";
import styles from "@/css/Blastp.module.css";


const DEFAULT_PARAMETERS: BlastpParameters = {
  database: "test_blastp_db",
  matrix: "BLOSUM62",
  eValue: "0.01",
  maxTargets: 50,
};


export default function BlastpAnalysis() {
  // The page owns shared form and request state; child components only render it.
  const [mode, setMode] = useState<InputMode>("paste");
  const [sequence, setSequence] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [parameters, setParameters] = useState(DEFAULT_PARAMETERS);
  const [job, setJob] = useState<BlastpJob | null>(null);
  const [results, setResults] = useState<BlastpResults | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function runBlastp() {
    setError("");
    setJob(null);
    setResults(null);

    if (mode === "paste" && !sequence.trim()) {
      setError("Enter at least one protein FASTA sequence.");
      return;
    }
    if (mode === "upload" && !file) {
      setError("Choose a FASTA file.");
      return;
    }

    setRunning(true);
    try {
      // Text input uses JSON, while uploaded files use multipart/form-data.
      const nextJob =
        mode === "paste"
          ? await submitText(sequence, parameters)
          : await submitFile(file as File, parameters);

      // The search endpoint returns metadata first; result rows are fetched separately.
      const nextResults = await fetchResults(nextJob.job_id);
      setJob(nextJob);
      setResults(nextResults);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "BLASTP request failed.",
      );
    } finally {
      setRunning(false);
    }
  }

  function clearForm() {
    setSequence("");
    setFile(null);
    setParameters(DEFAULT_PARAMETERS);
    setJob(null);
    setResults(null);
    setError("");
  }

  return (
    <div className={styles.page}>
      <Navigation />
      <main className={styles.main}>
        <section className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Analysis / Protein BLAST</p>
            <h1 className={styles.title}>BLASTP Homology Search</h1>
          </div>
        </section>

        <section className={styles.workspace}>
          <aside className={styles.sidebar}>
            <SequenceInput
              mode={mode}
              sequence={sequence}
              file={file}
              onModeChange={setMode}
              onSequenceChange={setSequence}
              onFileChange={setFile}
            />

            <Parameters value={parameters} onChange={setParameters} />

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.runBtn}
                disabled={running}
                onClick={runBlastp}
              >
                <Play size={16} fill="currentColor" strokeWidth={0} />
                {running ? "Running..." : "Run BLASTP"}
              </button>
              <button type="button" className={styles.clearBtn} onClick={clearForm}>
                Clear
              </button>
            </div>
          </aside>

          <div className={styles.resultsPane}>
            <BlastpResult
              key={job?.job_id ?? "empty"}
              job={job}
              results={results}
              running={running}
              error={error}
              loadAlignment={(hitId) => {
                if (!job) throw new Error("BLASTP job is unavailable.");
                return fetchAlignment(job.job_id, hitId);
              }}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
