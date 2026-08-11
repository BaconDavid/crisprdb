import styles from "@/css/Blastp.module.css";

import type { BlastpParameters } from "./types";


// Keep these options synchronized with the FastAPI validation rules.
const MATRICES = ["BLOSUM62", "BLOSUM45"];
const MAX_TARGETS = [10, 30, 50, 100];


type ParametersProps = {
  value: BlastpParameters;
  onChange: (value: BlastpParameters) => void;
};


export function Parameters({ value, onChange }: ParametersProps) {
  // Update one parameter without replacing the remaining form state.
  function update(changes: Partial<BlastpParameters>) {
    onChange({ ...value, ...changes });
  }

  return (
    <div className={styles.params}>
      <label className={styles.field}>
        <span className={styles.label}>Target database</span>
        <select
          className={styles.select}
          value={value.database}
          onChange={(event) =>
            update({ database: event.target.value as "test_blastp_db" })
          }
        >
          <option value="test_blastp_db">Test BLASTP database</option>
        </select>
      </label>

      <div className={styles.paramPair}>
        <label className={styles.field}>
          <span className={styles.label}>Matrix</span>
          <select
            className={styles.select}
            value={value.matrix}
            onChange={(event) => update({ matrix: event.target.value })}
          >
            {MATRICES.map((matrix) => (
              <option key={matrix} value={matrix}>
                {matrix}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>E-value ≤</span>
          <input
            type="text"
            inputMode="decimal"
            className={styles.select}
            value={value.eValue}
            onChange={(event) => update({ eValue: event.target.value })}
          />
        </label>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>Max target sequences</span>
        <select
          className={styles.select}
          value={value.maxTargets}
          onChange={(event) => update({ maxTargets: Number(event.target.value) })}
        >
          {MAX_TARGETS.map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
