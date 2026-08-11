import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AMINO_ACIDS = "ACDEFGHIKLMNPQRSTVWY";
const SEQUENCE_COUNT = 100;
const MIN_LENGTH = 150;
const MAX_LENGTH = 1200;
const LINE_WIDTH = 60;
const RANDOM_SEED = 20260727;

function createRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function wrapSequence(sequence) {
  const lines = [];

  for (let start = 0; start < sequence.length; start += LINE_WIDTH) {
    lines.push(sequence.slice(start, start + LINE_WIDTH));
  }

  return lines.join("\n");
}

const random = createRandom(RANDOM_SEED);
const records = [];

for (let index = 1; index <= SEQUENCE_COUNT; index += 1) {
  const length =
    MIN_LENGTH + Math.floor(random() * (MAX_LENGTH - MIN_LENGTH + 1));
  let sequence = "";

  for (let residue = 0; residue < length; residue += 1) {
    sequence += AMINO_ACIDS[Math.floor(random() * AMINO_ACIDS.length)];
  }

  const identifier = `test_protein_${String(index).padStart(3, "0")}`;
  records.push(
    `>${identifier} synthetic_random_protein length=${length} seed=${RANDOM_SEED}\n${wrapSequence(sequence)}`,
  );
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDirectory, "../test_data/random_proteins_100.fasta");

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${records.join("\n")}\n`, "utf8");

console.log(`Generated ${SEQUENCE_COUNT} protein sequences at ${outputPath}`);
