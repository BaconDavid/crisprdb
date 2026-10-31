export interface AvailableData {
  data_name: string;
  title: string;
  description: string;
  source: string | null;
  version: string;
}

interface AvailableDataResponse {
  available_data: AvailableData[];
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const DOWNLOAD_URL = `${API_BASE_URL}/api/data/download`;

export async function fetchAvailableData(signal?: AbortSignal) {
  const response = await fetch(`${DOWNLOAD_URL}/available_data`, { signal });

  if (!response.ok) {
    throw new Error("Unable to load available data.");
  }

  const data = (await response.json()) as AvailableDataResponse;
  return data.available_data;
}

export function getDownloadUrl(dataName: string) {
  return `${DOWNLOAD_URL}?data_name=${encodeURIComponent(dataName)}`;
}
