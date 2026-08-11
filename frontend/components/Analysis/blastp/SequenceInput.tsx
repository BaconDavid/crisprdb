import { useRef } from "react";
import { AlignLeft, FileText, Upload, X } from "lucide-react";

import styles from "@/css/Blastp.module.css";

import type { InputMode } from "./types";


type SequenceInputProps = {
  mode: InputMode;
  sequence: string;
  file: File | null;
  onModeChange: (mode: InputMode) => void;
  onSequenceChange: (sequence: string) => void;
  onFileChange: (file: File | null) => void;
};


export function SequenceInput({
  mode,
  sequence,
  file,
  onModeChange,
  onSequenceChange,
  onFileChange,
}: SequenceInputProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  function clearFile() {
    onFileChange(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <>
      <div className={styles.tabs} role="tablist" aria-label="BLASTP input mode">
        <button
          type="button"
          className={`${styles.tab} ${mode === "paste" ? styles.tabActive : ""}`}
          onClick={() => onModeChange("paste")}
        >
          <AlignLeft size={16} />
          Paste sequence
        </button>
        <button
          type="button"
          className={`${styles.tab} ${mode === "upload" ? styles.tabActive : ""}`}
          onClick={() => onModeChange("upload")}
        >
          <Upload size={16} />
          Upload FASTA
        </button>
      </div>

      {mode === "paste" ? (
        <label className={styles.field}>
          <span className={styles.fieldHead}>
            <span className={styles.label}>Query sequence(s)</span>
            <span className={styles.hint}>Up to 30 FASTA records</span>
          </span>
          <textarea
            className={styles.textarea}
            placeholder={">query_1\nMKTLLV..."}
            spellCheck={false}
            value={sequence}
            onChange={(event) => onSequenceChange(event.target.value)}
          />
          <span className={styles.hint}>
            Every sequence must begin with a unique &gt; identifier.
          </span>
        </label>
      ) : (
        <div className={styles.field}>
          <span className={styles.label}>Upload FASTA file</span>
          <label className={styles.dropzone}>
            <input
              ref={fileInput}
              type="file"
              accept=".fa,.fasta,.faa"
              onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            />
            <span className={styles.dropIcon}>
              <Upload size={24} />
            </span>
            <span className={styles.dropTitle}>
              Choose a <strong>FASTA file</strong>
            </span>
            <span className={styles.hint}>.fa / .fasta / .faa · up to 30 records</span>
          </label>

          {file && (
            <div className={styles.fileChip}>
              <FileText size={16} color="#2563eb" />
              <span>{file.name}</span>
              <button type="button" aria-label="Remove file" onClick={clearFile}>
                <X size={15} />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
