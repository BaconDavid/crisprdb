import { useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import Link from "next/link";

import styles from "@/css/Blastp.module.css";

import type {
  BlastpAlignment,
  BlastpHit,
  BlastpJob,
  BlastpResults,
} from "./types";


type BlastpResultProps = {
  job: BlastpJob | null;
  results: BlastpResults | null;
  running: boolean;
  error: string;
  loadAlignment: (hitId: number) => Promise<BlastpAlignment>;
};


function formatEValue(value: number) {
  if (value === 0) return "0";
  return value < 0.001 ? value.toExponential(2) : String(value);
}

// Split long alignments into fixed-width blocks with aligned coordinates.
function formatAlignment(alignment: BlastpAlignment) {
  const lineWidth = 180;
  const positionWidth = Math.max(
    alignment.query_end,
    alignment.subject_end,
  ).toString().length;
  const lines: string[] = [];
  let queryPosition = alignment.query_start;
  let subjectPosition = alignment.subject_start;

  for (let start = 0; start < alignment.query_sequence.length; start += lineWidth) {
    const query = alignment.query_sequence.slice(start, start + lineWidth);
    const subject = alignment.subject_sequence.slice(start, start + lineWidth);
    const match = alignment.match_line.slice(start, start + lineWidth);
    const queryEnd = queryPosition + query.replaceAll("-", "").length - 1;
    const subjectEnd = subjectPosition + subject.replaceAll("-", "").length - 1;
    // Query and Sbjct labels have the same width, so the match line stays aligned.
    const matchIndent = " ".repeat(9 + positionWidth);

    lines.push(
      `Query  ${String(queryPosition).padStart(positionWidth)}  ${query}  ${queryEnd}`,
      `${matchIndent}${match}`,
      `Sbjct  ${String(subjectPosition).padStart(positionWidth)}  ${subject}  ${subjectEnd}`,
      "",
    );

    queryPosition = queryEnd + 1;
    subjectPosition = subjectEnd + 1;
  }

  return lines.join("\n");
}


export function BlastpResult({
  job,
  results,
  running,
  error,
  loadAlignment,
}: BlastpResultProps) {
  const [expandedHit, setExpandedHit] = useState<number | null>(null);
  const [alignment, setAlignment] = useState<BlastpAlignment | null>(null);
  const [alignmentLoading, setAlignmentLoading] = useState(false);
  const [alignmentError, setAlignmentError] = useState("");
  const allHits = results ? Object.values(results).flat() : [];

  // Alignment data is requested only when the user expands a hit.
  async function toggleHit(hit: BlastpHit) {
    if (expandedHit === hit.hit_id) {
      setExpandedHit(null);
      return;
    }

    setExpandedHit(hit.hit_id);
    setAlignment(null);
    setAlignmentError("");
    setAlignmentLoading(true);
    try {
      setAlignment(await loadAlignment(hit.hit_id));
    } catch (requestError) {
      setAlignmentError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load the alignment.",
      );
    } finally {
      setAlignmentLoading(false);
    }
  }

  if (running) {
    return (
      <div className={styles.running}>
        <span className={styles.spinner} />
        <p>Running BLASTP...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <strong>Search failed</strong>
        <p>{error}</p>
      </div>
    );
  }

  if (!job || !results) {
    return (
      <div className={styles.empty}>
        <Search size={34} />
        <p className={styles.emptyTitle}>No search yet</p>
        <p className={styles.emptyText}>
          Add protein FASTA input and click Run BLASTP.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={styles.summaryGrid}>
        <div>
          <span>Queries</span>
          <strong>{job.query_count}</strong>
        </div>
        <div>
          <span>Hits found</span>
          <strong>{job.hit_count}</strong>
        </div>
        <div>
          <span>Top identity</span>
          <strong>
            {allHits.length ? `${Math.max(...allHits.map((hit) => hit.pident)).toFixed(1)}%` : "—"}
          </strong>
        </div>
        <div>
          <span>Run time</span>
          <strong>{job.duration_seconds}s</strong>
        </div>
      </div>

      <div className={styles.resultsHead}>
        <div>
          <h2>
            Ranked hits <span>({job.hit_count})</span>
          </h2>
          <p>
            {job.database} / {job.matrix} / E ≤ {job.e_value} / max targets{" "}
            {job.max_targets}
          </p>
        </div>
      </div>

      {Object.entries(results).map(([queryId, hits]) => (
        <section className={styles.queryGroup} key={queryId}>
          <h3 className={styles.queryTitle}>
            Query: <span>{queryId}</span> <small>{hits.length} hits</small>
          </h3>

          {hits.length === 0 ? (
            <p className={styles.noHits}>No significant hits found.</p>
          ) : (
            <div className={styles.table}>
              <div className={styles.thead}>
                <span />
                <span>Subject</span>
                <span>% Identity</span>
                <span>Cov</span>
                <span>Aln len</span>
                <span>E-value</span>
                <span>Bit score</span>
              </div>

              {hits.map((hit) => {
                const open = expandedHit === hit.hit_id;
                const alignmentId = `blastp-alignment-${hit.hit_id}`;
                return (
                  <div className={styles.hitRow} key={hit.hit_id}>
                    <div className={styles.hitMain}>
                      <button
                        type="button"
                        className={styles.hitToggle}
                        aria-expanded={open}
                        aria-controls={alignmentId}
                        aria-label={`${open ? "Hide" : "Show"} alignment for ${hit.sseqid}`}
                        onClick={() => toggleHit(hit)}
                      />
                      <ChevronRight
                        aria-hidden="true"
                        className={open ? styles.chevronOpen : ""}
                        size={16}
                      />
                      <Link
                        className={styles.subject}
                        href={{
                          pathname: "/Browse",
                          query: { entity: "protein", protein: hit.sseqid },
                        }}
                        title={`Open ${hit.sseqid} in Protein Browse`}
                      >
                        <strong>{hit.sseqid}</strong>
                        <small>{hit.stitle}</small>
                      </Link>
                      <span className={styles.identityCell}>
                        <span className={styles.identityTrack}>
                          <span style={{ width: `${hit.pident}%` }} />
                        </span>
                        <strong>{hit.pident.toFixed(1)}</strong>
                      </span>
                      <span>{hit.qcovhsp.toFixed(0)}%</span>
                      <span>{hit.length}</span>
                      <span className={styles.mono}>{formatEValue(hit.evalue)}</span>
                      <span>
                        <strong>{hit.bitscore.toFixed(1)}</strong>
                      </span>
                    </div>

                    {open && (
                      <div className={styles.expand} id={alignmentId}>
                        <div className={styles.alnMeta}>
                          <span>
                            Query range <strong>{hit.qstart}–{hit.qend}</strong>
                          </span>
                          <span>
                            Positives <strong>{hit.positive}/{hit.length} ({hit.ppos.toFixed(1)}%)</strong>
                          </span>
                          <span>
                            Gaps <strong>{hit.gaps}/{hit.length}</strong>
                          </span>
                        </div>

                        {alignmentLoading && <p>Loading alignment...</p>}
                        {alignmentError && <p className={styles.alignmentError}>{alignmentError}</p>}
                        {alignment && (
                          <pre>{formatAlignment(alignment)}</pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ))}
    </>
  );
}
