"use client";

import { ArrowLeft, BarChart3, Box, Download, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { FilterTab, type FilterSection } from "./FilterTab";
import { BrowseTable, type BrowseColumn } from "./Tabel";
import {
  fetchCasProtein,
  fetchCasProteinFilters,
  fetchCasProteins,
  type BrowseFilters,
  type CasProtein,
  type CasProteinFilterData,
  type CasProteinListResponse,
  type ProteinAnnotation,
} from "./api";
import styles from "@/css/Browse.module.css";

const ANNOTATION_SOURCE = "cctyper";
const DOMAIN_COLORS = [
  "#2563eb", "#14b8a6", "#a855f7", "#f59e0b", "#ef4444",
  "#0ea5e9", "#22c55e", "#ec4899", "#6366f1", "#0d9488",
];
const DOMAIN_SOURCE_COLORS: Record<string, string> = {
  Pfam: "#2563eb",
  Gene3D: "#14b8a6",
  SUPERFAMILY: "#a855f7",
  PANTHER: "#f59e0b",
  CDD: "#ef4444",
};
const INTERPRO_SOURCE_PATHS: Record<string, string> = {
  Pfam: "pfam",
  Gene3D: "cathgene3d",
  SUPERFAMILY: "ssf",
  PANTHER: "panther",
  SMART: "smart",
  PROSITE: "profile",
  TIGRFAM: "ncbifam",
  NCBIfam: "ncbifam",
};

const FILTER_SECTIONS: FilterSection[] = [
  {
    id: "operon-type",
    title: "Cas Operon Type",
    groups: [
      { field: "crispr_class", label: "Class" },
      { field: "crispr_type", label: "Type" },
      { field: "crispr_subtype", label: "Subtype" },
    ],
  },
  {
    id: "protein-name",
    title: "Protein Name",
    groups: [{ field: "protein_name", label: "HMM profile annotation" }],
  },
  {
    id: "sample",
    title: "Sample Info",
    groups: [
      { field: "host", label: "Host" },
      { field: "country", label: "Country" },
    ],
  },
  {
    id: "taxonomy",
    title: "Taxon",
    groups: [
      { field: "lineage_domain", label: "Domain" },
      { field: "lineage_phylum", label: "Phylum" },
      { field: "lineage_class", label: "Class" },
      { field: "lineage_order", label: "Order" },
      { field: "lineage_family", label: "Family" },
      { field: "lineage_genus", label: "Genus" },
      { field: "lineage_species", label: "Species" },
      { field: "lineage_strain", label: "Strain" },
    ],
  },
];

function display(value: string | number | null) {
  return value === null || value === "" ? "NA" : value;
}

function formatSequence(sequence: string) {
  return sequence.match(/.{1,60}/g)?.join("\n") ?? sequence;
}

function annotationUrl(source: string, accession: string | null) {
  if (!accession) return null;
  if (source === "CDD") {
    return `https://www.ncbi.nlm.nih.gov/Structure/cdd/cddsrv.cgi?uid=${encodeURIComponent(accession)}`;
  }
  if (source === "MobiDBLite") {
    return `https://mobidb.org/annotations/${encodeURIComponent(accession)}`;
  }
  const sourcePath = INTERPRO_SOURCE_PATHS[source];
  return sourcePath
    ? `https://www.ebi.ac.uk/interpro/entry/${sourcePath}/${encodeURIComponent(accession)}`
    : null;
}

const COLUMNS: BrowseColumn<CasProtein>[] = [
  {
    key: "protein_header",
    label: "protein_header",
    render: (protein) => <span className={styles.operonId}>{protein.protein_header}</span>,
  },
  {
    key: "annotation_name",
    label: "annotation_name",
    render: (protein) => (
      <strong className={styles.proteinName}>{display(protein.annotation_name)}</strong>
    ),
  },
  {
    key: "length",
    label: "length",
    render: (protein) => <span className={styles.proteinLength}>{protein.length} aa</span>,
  },
  {
    key: "operon_header",
    label: "operon_header",
    render: (protein) => <span className={styles.componentList}>{protein.operon_header}</span>,
  },
];

interface DomainGroup {
  source: string;
  color: string;
  annotations: ProteinAnnotation[];
}

type ProteinTool = "blastp" | "structure" | "embedding";

export function ProteinDetailView({
  protein,
  loading,
  error,
  onBack,
}: {
  protein: CasProtein;
  loading: boolean;
  error: string | null;
  onBack: () => void;
}) {
  const [tool, setTool] = useState<ProteinTool>("blastp");
  const groups = useMemo<DomainGroup[]>(() => {
    const bySource = new Map<string, ProteinAnnotation[]>();
    protein.annotations.forEach((annotation) => {
      const source = annotation.source_db || "Unknown";
      const current = bySource.get(source) ?? [];
      current.push(annotation);
      bySource.set(source, current);
    });
    return Array.from(bySource, ([source, annotations], index) => ({
      source,
      annotations,
      color: DOMAIN_SOURCE_COLORS[source] ?? DOMAIN_COLORS[index % DOMAIN_COLORS.length],
    }));
  }, [protein.annotations]);

  const lineage = [
    protein.lineage_phylum,
    protein.lineage_class,
    protein.lineage_order,
    protein.lineage_family,
    protein.lineage_genus,
    protein.lineage_species,
    protein.lineage_strain,
  ].map(display);
  const axis = [0, 1, 2, 3, 4].map((index) =>
    Math.round((protein.length * index) / 4),
  );
  const stats = [
    ["Length", `${protein.length.toLocaleString()} aa`],
    ["Strand", protein.strand < 0 ? "− (reverse)" : "+ (forward)"],
    ["Start", protein.start_pos.toLocaleString()],
    ["End", protein.end_pos.toLocaleString()],
    ["Cas subtype", display(protein.crispr_subtype)],
    ["Country", display(protein.country)],
  ];

  function downloadFasta() {
    const fasta = `>${protein.protein_header}\n${formatSequence(protein.sequence)}\n`;
    const url = URL.createObjectURL(new Blob([fasta], { type: "text/plain" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${protein.protein_header}.fasta`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <article className={styles.proteinDetailCard}>
      <div className={styles.proteinDetailToolbar}>
        <button type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={15} />
          Back
        </button>
        <span>Protein detail</span>
      </div>

      <div className={styles.proteinDetailBody}>
        <div className={styles.proteinDetailHero}>
          <div>
            <h2>{protein.protein_header}</h2>
            <p>{lineage.join(" | ")}</p>
          </div>
          <div className={styles.proteinActions}>
            <div className={styles.proteinToolTabs}>
              <button
                type="button"
                className={tool === "blastp" ? styles.activeProteinTool : undefined}
                onClick={() => setTool("blastp")}
              >
                <Play aria-hidden="true" size={15} fill="currentColor" />
                Run BLASTP
              </button>
              <button
                type="button"
                className={tool === "structure" ? styles.activeProteinTool : undefined}
                onClick={() => setTool("structure")}
              >
                <Box aria-hidden="true" size={16} />
                Show Structure
              </button>
              <button
                type="button"
                className={tool === "embedding" ? styles.activeProteinTool : undefined}
                onClick={() => setTool("embedding")}
              >
                <BarChart3 aria-hidden="true" size={16} />
                Embedding Search
              </button>
            </div>
            {tool === "blastp" ? (
              <Link
                href={{
                  pathname: "/Analysis/blastp",
                  query: { protein: protein.protein_header },
                }}
                className={styles.runProteinTool}
                target="_blank"
                rel="noopener noreferrer"
              >
                Run
              </Link>
            ) : (
              <button
                type="button"
                className={styles.runProteinTool}
                disabled
                title="This analysis will be connected next"
              >
                Run
              </button>
            )}
          </div>
        </div>

        <dl className={styles.proteinStats}>
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <section className={styles.interproSection}>
          <div className={styles.interproHeading}>
            <h3>Protein domains · InterProScan</h3>
            <span>One row per source database · hover a domain for details</span>
          </div>

          {loading && <p className={styles.detailMessage}>Loading InterProScan annotations…</p>}
          {error && <p className={styles.detailError}>{error}</p>}
          {!loading && !error && groups.length === 0 && (
            <p className={styles.detailMessage}>No InterProScan annotations are available.</p>
          )}

          {!loading && !error && groups.length > 0 && (
            <>
              <div className={styles.domainChart}>
                <div className={styles.domainAxisRow}>
                  <strong>Database</strong>
                  <div className={styles.domainAxis}>
                    {axis.map((value, index) => (
                      <span
                        key={`${value}-${index}`}
                        style={{ left: `${index * 25}%` }}
                      >
                        {value.toLocaleString()}
                      </span>
                    ))}
                  </div>
                </div>
                <div className={styles.domainRows}>
                  {groups.map((group) => (
                    <div key={group.source} className={styles.domainRow}>
                      <div className={styles.domainSource}>
                        <i style={{ background: group.color }} />
                        <strong>{group.source}</strong>
                        <span>{group.annotations.length}</span>
                      </div>
                      <div className={styles.domainTrack}>
                        <div className={styles.domainBackbone} />
                        {group.annotations.map((annotation, index) => {
                          const start = Math.max(annotation.start_pos ?? 1, 1);
                          const end = Math.min(annotation.end_pos ?? start, protein.length);
                          const left = ((start - 1) / Math.max(protein.length, 1)) * 100;
                          const width = Math.max(((end - start + 1) / Math.max(protein.length, 1)) * 100, 1.5);
                          const title = [
                            annotation.annotation_acc,
                            annotation.annotation_name,
                            `${start}–${end} aa`,
                          ].filter(Boolean).join(" · ");
                          return (
                            <div
                              key={`${annotation.annotation_acc}-${start}-${end}-${index}`}
                              className={styles.domainBlock}
                              style={{ left: `${left}%`, width: `${width}%`, background: group.color }}
                              title={title}
                              aria-label={title}
                            >
                              <span>{display(annotation.annotation_acc)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.domainDetails}>
                {groups.flatMap((group) =>
                  group.annotations.map((annotation, index) => {
                    const url = annotationUrl(group.source, annotation.annotation_acc);
                    return (
                      <div
                        key={`${group.source}-${annotation.annotation_acc}-${index}`}
                        className={styles.domainDetailRow}
                      >
                        <strong>{group.source}</strong>
                        {url ? (
                          <a
                            className={styles.domainAccession}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {annotation.annotation_acc}
                          </a>
                        ) : (
                          <span>{display(annotation.annotation_acc)}</span>
                        )}
                        <span>{display(annotation.annotation_name)}</span>
                        <span>
                          {display(annotation.start_pos)}–{display(annotation.end_pos)}
                        </span>
                      </div>
                    );
                  }),
                )}
              </div>
            </>
          )}
        </section>

        <section className={styles.sequenceSection}>
          <h3>Amino acid sequence</h3>
          <pre className={styles.proteinSequence}>{formatSequence(protein.sequence)}</pre>
        </section>

        <div className={styles.proteinDownloads}>
          <button type="button" onClick={downloadFasta}>
            <Download aria-hidden="true" size={16} />
            Download FASTA
          </button>
          <button type="button" disabled title="No structure file is available yet">
            <Download aria-hidden="true" size={16} />
            Download Structure (PDB)
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProteinBrowse() {
  const [filterData, setFilterData] = useState<CasProteinFilterData | null>(null);
  const [filters, setFilters] = useState<BrowseFilters>({});
  const [result, setResult] = useState<CasProteinListResponse>({
    items: [], total: 0, page: 1, page_size: 10, annotation_source: ANNOTATION_SOURCE,
  });
  const [selectedProtein, setSelectedProtein] = useState<CasProtein | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchCasProteinFilters(ANNOTATION_SOURCE, controller.signal)
      .then(setFilterData)
      .catch((requestError: Error) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchCasProteins(filters, page, pageSize, ANNOTATION_SOURCE, controller.signal)
      .then(setResult)
      .catch((requestError: Error) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters, page, pageSize]);

  function toggleFilter(field: string, value: string) {
    setLoading(true);
    setError(null);
    setSelectedProtein(null);
    setFilters((current) => {
      const values = current[field] ?? [];
      const nextValues = values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];
      const next = { ...current };
      if (nextValues.length > 0) next[field] = nextValues;
      else delete next[field];
      return next;
    });
    setPage(1);
  }

  async function openProtein(protein: CasProtein) {
    setSelectedProtein(protein);
    setDetailLoading(true);
    setDetailError(null);
    try {
      setSelectedProtein(await fetchCasProtein(protein.protein_header, ANNOTATION_SOURCE));
    } catch (requestError) {
      setDetailError(
        requestError instanceof Error ? requestError.message : "Unable to load protein detail.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className={styles.browseLayout}>
      <FilterTab
        ariaLabel="Protein filters"
        sections={FILTER_SECTIONS}
        facets={filterData?.facets ?? {}}
        selected={filters}
        geneBounds={null}
        geneRange={null}
        loading={!filterData && loading}
        onToggle={toggleFilter}
        onGeneRangeChange={() => undefined}
        onReset={() => {
          setLoading(true);
          setError(null);
          setSelectedProtein(null);
          setFilters({});
          setPage(1);
        }}
      />

      {selectedProtein ? (
        <ProteinDetailView
          protein={selectedProtein}
          loading={detailLoading}
          error={detailError}
          onBack={() => setSelectedProtein(null)}
        />
      ) : (
        <BrowseTable
          entityNoun="proteins"
          columns={COLUMNS}
          gridTemplate="minmax(260px, 2.1fr) 180px 110px minmax(240px, 1.9fr)"
          rows={result.items}
          total={result.total}
          page={page}
          pageSize={pageSize}
          loading={loading}
          error={error}
          expandedRowId={null}
          showChevron={false}
          getRowId={(protein) => protein.protein_header}
          renderExpanded={() => null}
          onToggleRow={openProtein}
          onPageChange={(nextPage) => {
            setLoading(true);
            setError(null);
            setPage(nextPage);
          }}
          onPageSizeChange={(size) => {
            setLoading(true);
            setError(null);
            setPageSize(size);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}
