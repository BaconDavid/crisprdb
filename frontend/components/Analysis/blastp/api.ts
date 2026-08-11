import type {
  BlastpAlignment,
  BlastpJob,
  BlastpParameters,
  BlastpResults,
} from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const BLASTP_URL = `${API_BASE_URL}/api/analysis/blastp`;

// Convert non-successful FastAPI responses into errors the UI can display.
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail ?? "BLASTP request failed.");
  }

  return data as T;
}

export function submitText(
  fastaContent: string,
  parameters: BlastpParameters,
): Promise<BlastpJob> {
  return request<BlastpJob>(`${BLASTP_URL}/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fasta_content: fastaContent,
      database: parameters.database,
      e_value: Number(parameters.eValue),
      max_targets: parameters.maxTargets,
      matrix: parameters.matrix,
    }),
  });
}

export function submitFile(
  file: File,
  parameters: BlastpParameters,
): Promise<BlastpJob> {
  // File uploads use multipart/form-data instead of a JSON request body.
  const formData = new FormData();
  formData.append("file", file);
  formData.append("database", parameters.database);
  formData.append("e_value", parameters.eValue);
  formData.append("max_targets", String(parameters.maxTargets));
  formData.append("matrix", parameters.matrix);

  return request<BlastpJob>(`${BLASTP_URL}/upload`, {
    method: "POST",
    body: formData,
  });
}

export function fetchResults(jobId: string): Promise<BlastpResults> {
  return request<BlastpResults>(`${BLASTP_URL}/jobs/${jobId}/results`);
}

export function fetchAlignment(
  jobId: string,
  hitId: number,
): Promise<BlastpAlignment> {
  return request<BlastpAlignment>(
    `${BLASTP_URL}/jobs/${jobId}/hits/${hitId}/alignment`,
  );
}
