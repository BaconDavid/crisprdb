export type InputMode = "paste" | "upload";

export type BlastpParameters = {
  database: "test_blastp_db";
  matrix: string;
  eValue: string;
  maxTargets: number;
};

export type BlastpJob = {
  job_id: string;
  status: "completed";
  query_count: number;
  query_ids: string[];
  database: "test_blastp_db";
  matrix: string;
  e_value: number;
  max_targets: number;
  hit_count: number;
  duration_seconds: number;
};

export type BlastpHit = {
  hit_id: number;
  qseqid: string;
  sseqid: string;
  stitle: string;
  nident: number;
  pident: number;
  qlen: number;
  length: number;
  qcovhsp: number;
  gaps: number;
  gapopen: number;
  mismatch: number;
  positive: number;
  ppos: number;
  qstart: number;
  qend: number;
  sstart: number;
  send: number;
  score: number;
  evalue: number;
  bitscore: number;
};

export type BlastpResults = Record<string, BlastpHit[]>;

export type BlastpAlignment = {
  hit_id: number;
  query_id: string;
  target_id: string;
  query_start: number;
  query_end: number;
  subject_start: number;
  subject_end: number;
  query_sequence: string;
  subject_sequence: string;
  match_line: string;
};
