export interface CasOperonGene {
  protein_header: string;
  annotation_name: string | null;
  start_pos: number;
  end_pos: number;
  strand: number;
  length: number;
}

export interface CasOperon {
  operon_header: string;
  n_genes: number;
  crispr_class: number | null;
  crispr_type: string | null;
  crispr_subtype: string | null;
  annotated_by: string | null;
  genome_header: string;
  country: string | null;
  host: string | null;
  source: string | null;
  lineage_domain: string | null;
  lineage_phylum: string | null;
  lineage_class: string | null;
  lineage_order: string | null;
  lineage_family: string | null;
  lineage_genus: string | null;
  lineage_species: string | null;
  lineage_strain: string | null;
  genes: CasOperonGene[];
}

export interface CasOperonListResponse {
  items: CasOperon[];
  total: number;
  page: number;
  page_size: number;
}

export interface CasOperonFilterData {
  facets: Record<string, Record<string, number>>;
  gene_count: {
    minimum: number;
    maximum: number;
  };
}

export interface ProteinAnnotation {
  annotation_software: string | null;
  source_db: string | null;
  annotation_acc: string | null;
  annotation_name: string | null;
  e_value: number | null;
  bitscore: number | null;
  start_pos: number | null;
  end_pos: number | null;
  extra: Record<string, unknown> | null;
}

export interface CasProtein {
  protein_header: string;
  annotation_name: string | null;
  annotation_source: string;
  annotation_acc: string | null;
  annotation_e_value: number | null;
  annotation_bitscore: number | null;
  start_pos: number;
  end_pos: number;
  strand: number;
  length: number;
  sequence: string;
  operon_header: string;
  crispr_class: number | null;
  crispr_type: string | null;
  crispr_subtype: string | null;
  genome_header: string;
  country: string | null;
  host: string | null;
  source: string | null;
  lineage_domain: string | null;
  lineage_phylum: string | null;
  lineage_class: string | null;
  lineage_order: string | null;
  lineage_family: string | null;
  lineage_genus: string | null;
  lineage_species: string | null;
  lineage_strain: string | null;
  annotations: ProteinAnnotation[];
}

export interface CasProteinListResponse {
  items: CasProtein[];
  total: number;
  page: number;
  page_size: number;
  annotation_source: string;
}

export interface CasProteinFilterData {
  facets: Record<string, Record<string, number>>;
  annotation_source: string;
}

export type BrowseFilters = Record<string, string[]>;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const CAS_OPERON_URL = `${API_BASE_URL}/api/browse/cas-operons`;
const CAS_PROTEIN_URL = `${API_BASE_URL}/api/browse/cas-proteins`;

async function request<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail ?? "Unable to load browse data.");
  }

  return data as T;
}

export function fetchCasOperonFilters(signal?: AbortSignal) {
  return request<CasOperonFilterData>(`${CAS_OPERON_URL}/filters`, signal);
}

export function fetchCasOperons(
  filters: BrowseFilters,
  geneRange: [number, number] | null,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ // URLSearchParms is used to deal with dirty params in the url
    page: String(page),
    page_size: String(pageSize),
  });

  Object.entries(filters).forEach(([field, values]) => {
    values.forEach((value) => params.append(field, value));
  });

  if (geneRange) {
    params.set("min_genes", String(geneRange[0]));
    params.set("max_genes", String(geneRange[1]));
  }

  return request<CasOperonListResponse>(
    `${CAS_OPERON_URL}/?${params.toString()}`,
    signal,
  );
}

export function fetchCasProteinFilters(
  annotationSource: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ annotation_source: annotationSource });
  return request<CasProteinFilterData>(
    `${CAS_PROTEIN_URL}/filters?${params.toString()}`,
    signal,
  );
}

export function fetchCasProteins(
  filters: BrowseFilters,
  page: number,
  pageSize: number,
  annotationSource: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    annotation_source: annotationSource,
  });

  Object.entries(filters).forEach(([field, values]) => {
    values.forEach((value) => params.append(field, value));
  });

  return request<CasProteinListResponse>(
    `${CAS_PROTEIN_URL}/?${params.toString()}`,
    signal,
  );
}

export function fetchCasProtein(
  proteinHeader: string,
  annotationSource: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ annotation_source: annotationSource });
  return request<CasProtein>(
    `${CAS_PROTEIN_URL}/${encodeURIComponent(proteinHeader)}?${params.toString()}`,
    signal,
  );
}
