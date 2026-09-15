export type AsyncStatus = "idle" | "running" | "done" | "error";
export type StructureJobStatus = "queued" | "running" | "completed" | "failed";
export type FoldseekJobStatus = "queued" | "running" | "completed" | "failed";
export type FoldseekQuerySource = "sequence" | "structure" | "prediction";

export interface StructureResult {
  index: number;
  query_id: string;
  description: string;
  sequence_length: number;
  mean_plddt: number;
  ptm: number;
}

export interface StructureJob {
  job_id: string;
  status: StructureJobStatus;
  model: "esmfold_v1";
  recycles: number;
  query_count: number;
  query_ids: string[];
  progress: number;
  completed_count: number;
  current_query?: string;
  error?: string;
  structures: StructureResult[];
}

export interface StructureResults {
  job_id: string;
  status: "completed";
  model: "esmfold_v1";
  structures: StructureResult[];
}

export interface StructureModel {
  jobId: string;
  resultIndex: number;
  title: string;
  engine: "esmfold_v1";
  sequenceLength: number;
  pdbText: string;
  meanPlddt: number;
  ptm: number;
}

export interface FoldseekHit {
  query: string;
  target: string;
  description: string;
  identity: number;
  query_coverage: number;
  target_coverage: number;
  aligned_length: number;
  query_start: number;
  query_end: number;
  target_start: number;
  target_end: number;
  evalue: string;
  bit_score: number;
}

export interface FoldseekJob {
  job_id: string;
  status: FoldseekJobStatus;
  source: FoldseekQuerySource;
  source_job_id?: string | null;
  query_count: number;
  query_ids: string[];
  target_database: string;
  e_value: number;
  max_hits: number;
  progress: number;
  stage?: string;
  hit_count?: number;
  error?: string;
}

export interface FoldseekResults {
  job_id: string;
  status: "completed";
  source: FoldseekQuerySource;
  target_database: string;
  hits: FoldseekHit[];
}

export interface StructureAlignment {
  target: FoldseekHit;
  queryLength: number;
  targetLength: number;
  alignedLength: number;
  rmsd: number;
  tmQuery: number;
  tmTarget: number;
  identity: number;
  queryAlignment: string;
  targetAlignment: string;
}

export const FOLDSEEK_DATABASES = [
  { value: "crisprdb_structures", label: "CRISPRdb structures" },
] as const;

export const DEFAULT_SEQUENCE = `>demo_Cas_protein
MKKYSIGLDIGTNSVGWAVITDEYKVPSKKFKVLGNTDRHSIKKNLIGALLFDSGETAEATRLKRTARRRYTRRKNRICYLQEIFSNEMAKVDDSFFHRLEESFLVEEDKKHERHPIFGNIVDEVAYHEKYPTIYHLRKKLVDSTDKADLRLIYLALAHMIKFRGHFLIEGDLNPDNSDVDKLFIQLVQTYNQLFEENPINASGVDAKAILSARLSKSRRLENLIAQLPGEKKNGLFGNLIALSLGLTPNFKSNFDLAEDAKLQLSKDTYDDDLDNLLAQIGDQYADLFLAAKNLSDAILLSDILRVNTEITKAPLSASMIKRYDEHHQDLTLLKALVRQQLPEKYKEIFFDQSKNGYAGYIDGGASQEEFYKFIKPILEKMDGTEELLVKLNREDLLRKQRTF`;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const STRUCTURE_URL = `${API_BASE_URL}/api/analysis/structure`;

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.detail ?? `Request failed with status ${response.status}.`);
  }
  return data as T;
}

export function createStructureTextJob(
  fastaContent: string,
  recycles: number,
  signal?: AbortSignal,
) {
  return requestJson<StructureJob>(`${STRUCTURE_URL}/jobs/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fasta_content: fastaContent, recycles }),
    signal,
  });
}

export function createStructureUploadJob(
  file: File,
  recycles: number,
  signal?: AbortSignal,
) {
  const body = new FormData();
  body.append("file", file);
  body.append("recycles", String(recycles));
  return requestJson<StructureJob>(`${STRUCTURE_URL}/jobs/upload`, {
    method: "POST",
    body,
    signal,
  });
}

export function fetchStructureJob(jobId: string, signal?: AbortSignal) {
  return requestJson<StructureJob>(
    `${STRUCTURE_URL}/jobs/${encodeURIComponent(jobId)}`,
    { signal },
  );
}

export function fetchStructureResults(jobId: string, signal?: AbortSignal) {
  return requestJson<StructureResults>(
    `${STRUCTURE_URL}/jobs/${encodeURIComponent(jobId)}/results`,
    { signal },
  );
}

export async function fetchStructurePdb(
  jobId: string,
  resultIndex: number,
  signal?: AbortSignal,
) {
  const response = await fetch(
    `${STRUCTURE_URL}/jobs/${encodeURIComponent(jobId)}/structures/${resultIndex}`,
    { signal },
  );
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail ?? "Unable to load the predicted structure.");
  }
  return response.text();
}

export function createFoldseekSequenceTextJob(
  fastaContent: string,
  targetDatabase: string,
  eValue: number,
  maxHits: number,
  signal?: AbortSignal,
) {
  return requestJson<FoldseekJob>(`${STRUCTURE_URL}/foldseek/jobs/sequence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fasta_content: fastaContent,
      target_database: targetDatabase,
      e_value: eValue,
      max_hits: maxHits,
    }),
    signal,
  });
}

export function createFoldseekSequenceUploadJob(
  file: File,
  targetDatabase: string,
  eValue: number,
  maxHits: number,
  signal?: AbortSignal,
) {
  const body = new FormData();
  body.append("file", file);
  body.append("target_database", targetDatabase);
  body.append("e_value", String(eValue));
  body.append("max_hits", String(maxHits));
  return requestJson<FoldseekJob>(
    `${STRUCTURE_URL}/foldseek/jobs/sequence/upload`,
    { method: "POST", body, signal },
  );
}

export function createFoldseekStructureUploadJob(
  files: File[],
  targetDatabase: string,
  eValue: number,
  maxHits: number,
  signal?: AbortSignal,
) {
  const body = new FormData();
  files.forEach((file) => body.append("files", file));
  body.append("target_database", targetDatabase);
  body.append("e_value", String(eValue));
  body.append("max_hits", String(maxHits));
  return requestJson<FoldseekJob>(
    `${STRUCTURE_URL}/foldseek/jobs/structure/upload`,
    { method: "POST", body, signal },
  );
}

export function createFoldseekPredictionJob(
  predictionJobId: string,
  resultIndexes: number[],
  targetDatabase: string,
  signal?: AbortSignal,
) {
  return requestJson<FoldseekJob>(`${STRUCTURE_URL}/foldseek/jobs/prediction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prediction_job_id: predictionJobId,
      result_indexes: resultIndexes,
      target_database: targetDatabase,
    }),
    signal,
  });
}

export function fetchFoldseekJob(jobId: string, signal?: AbortSignal) {
  return requestJson<FoldseekJob>(
    `${STRUCTURE_URL}/foldseek/jobs/${encodeURIComponent(jobId)}`,
    { signal },
  );
}

export function fetchFoldseekResults(jobId: string, signal?: AbortSignal) {
  return requestJson<FoldseekResults>(
    `${STRUCTURE_URL}/foldseek/jobs/${encodeURIComponent(jobId)}/results`,
    { signal },
  );
}

export function cleanSequence(raw: string) {
  return raw
    .split("\n")
    .filter((line) => !line.trim().startsWith(">"))
    .join("")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
}

export function formatFasta(sequence: string, header = "query_1") {
  const clean = cleanSequence(sequence);
  return `>${header}\n${clean.match(/.{1,60}/g)?.join("\n") ?? clean}`;
}
