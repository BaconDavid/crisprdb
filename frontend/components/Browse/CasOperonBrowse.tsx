"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { FilterTab, type FilterSection } from "./FilterTab";
import { ProteinDetailView } from "./ProteinBrowse";
import { BrowseTable, type BrowseColumn } from "./Tabel";
import {
  fetchCasProtein,
  fetchCasOperonFilters,
  fetchCasOperons,
  type BrowseFilters,
  type CasOperon,
  type CasOperonFilterData,
  type CasOperonListResponse,
  type CasProtein,
} from "./api";
import styles from "@/css/Browse.module.css";

const FILTER_SECTIONS: FilterSection[] = [
  {
    id: "cas-type",
    title: "Cas Type",
    groups: [
      { field: "crispr_class", label: "Class" },
      { field: "crispr_type", label: "Type" },
      { field: "crispr_subtype", label: "Subtype" },
    ],
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

const COLUMNS: BrowseColumn<CasOperon>[] = [
  {
    key: "operon_header",
    label: "operon_header",
    render: (operon) => (
      <span className={styles.operonId}>{operon.operon_header}</span>
    ),
  },
  {
    key: "n_genes",
    label: "n_genes",
    render: (operon) => <strong>{operon.n_genes}</strong>,
  },
  {
    key: "cas_pro_component",
    label: "cas_pro_component",
    render: (operon) => (
      <span className={styles.componentList}>
        {operon.genes.map(geneName).join(" | ") || "No protein records"}
      </span>
    ),
  },
];

const UNANNOTATED_GENE_COLOR = "#94a3b8";
const GOLDEN_ANGLE = 137.508;

function generateGeneColors(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const hue = (217 + index * GOLDEN_ANGLE) % 360;
    const lightness = hue >= 40 && hue <= 190 ? 39 : hue < 25 ? 47 : 50;
    return `hsl(${hue.toFixed(1)}, 80%, ${lightness}%)`;
  });
}

function geneName(gene: CasOperon["genes"][number]) {
  return gene.annotation_name || gene.protein_header;
}

function geneShortName(gene: CasOperon["genes"][number]) {
  return gene.annotation_name?.split("_")[0] || null;
}

function display(value: string | number | null) {
  return value === null || value === "" ? "NA" : value;
}

function GeneCluster({
  operon,
  onOpenProtein,
}: {
  operon: CasOperon;
  onOpenProtein: (proteinHeader: string) => void;
}) {
  if (operon.genes.length === 0) {
    return <p className={styles.noGeneData}>No protein coordinates are available.</p>;
  }

  const start = Math.min(...operon.genes.map((gene) => gene.start_pos));
  const end = Math.max(...operon.genes.map((gene) => gene.end_pos));
  const span = Math.max(end - start, 1);
  const annotationNames = Array.from(
    new Set(
      operon.genes.flatMap((gene) =>
        gene.annotation_name ? [gene.annotation_name] : [],
      ),
    ),
  );
  const geneColors = generateGeneColors(annotationNames.length);
  const colorByAnnotation = new Map(
    annotationNames.map((name, index) => [name, geneColors[index]]),
  );
  const displayColor = (gene: CasOperon["genes"][number]) =>
    gene.annotation_name
      ? colorByAnnotation.get(gene.annotation_name) ?? UNANNOTATED_GENE_COLOR
      : UNANNOTATED_GENE_COLOR;

  return (
    <div className={styles.geneSection}>
      <div className={styles.geneHeading}>
        <strong>Gene cluster</strong>
        <span>{span.toLocaleString()} bp · {operon.genes.length} genes</span>
      </div>
      <div className={styles.geneTrack}>
        <div className={styles.geneBackbone} />
        {operon.genes.map((gene) => {
          const name = geneName(gene);
          const shortName = geneShortName(gene);
          const left = ((gene.start_pos - start) / span) * 100;
          const width = Math.max(((gene.end_pos - gene.start_pos) / span) * 100, 2);
          const strand = gene.strand < 0 ? "Reverse" : "Forward";
          const details = [
            `Annotation: ${name}`,
            `Protein: ${gene.protein_header}`,
            `Position: ${gene.start_pos.toLocaleString()}-${gene.end_pos.toLocaleString()} bp`,
            `Strand: ${strand}`,
            `Length: ${gene.length.toLocaleString()} aa`,
          ].join("\n");

          return (
            <button
              type="button"
              key={gene.protein_header}
              className={gene.strand < 0 ? styles.geneReverse : styles.geneForward}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: displayColor(gene),
              }}
              title={details}
              aria-label={details.replaceAll("\n", ". ")}
              onClick={() => onOpenProtein(gene.protein_header)}
            >
              {shortName && <span>{shortName}</span>}
            </button>
          );
        })}
      </div>
      {annotationNames.length > 0 && (
        <div className={styles.geneLegend}>
          {annotationNames.map((name) => (
            <span key={name}>
              <i style={{ background: colorByAnnotation.get(name) }} />
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function OperonDetails({
  operon,
  onOpenProtein,
}: {
  operon: CasOperon;
  onOpenProtein: (proteinHeader: string) => void;
}) {
  const metadata = [
    ["Cas subtype", `${display(operon.crispr_subtype)} · Class ${display(operon.crispr_class)}`],
    ["Country", display(operon.country)],
    ["Host", display(operon.host)],
    ["Genome (contig)", operon.genome_header],
    ["Annotated by", display(operon.annotated_by)],
  ];
  const lineage = [
    operon.lineage_domain,
    operon.lineage_phylum,
    operon.lineage_class,
    operon.lineage_order,
    operon.lineage_family,
    operon.lineage_genus,
    operon.lineage_species,
    operon.lineage_strain,
  ].map(display);

  return (
    <div>
      <dl className={styles.metadataStrip}>
        {metadata.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.lineageBlock}>
        <span>Taxonomic lineage</span>
        <p>{lineage.join(" | ")}</p>
      </div>
      <GeneCluster operon={operon} onOpenProtein={onOpenProtein} />
    </div>
  );
}

export function CasOperonBrowse() {
  const [filterData, setFilterData] = useState<CasOperonFilterData | null>(null);
  const [filters, setFilters] = useState<BrowseFilters>({});
  const [geneRange, setGeneRange] = useState<[number, number] | null>(null);
  const [result, setResult] = useState<CasOperonListResponse>({
    items: [], total: 0, page: 1, page_size: 10,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [selectedProtein, setSelectedProtein] = useState<CasProtein | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const detailRequest = useRef<AbortController | null>(null);

  useEffect(() => () => {
    detailRequest.current?.abort();
    detailRequest.current = null;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchCasOperonFilters(controller.signal)
      .then((data) => {
        setFilterData(data);
        setGeneRange([data.gene_count.minimum, data.gene_count.maximum]);
      })
      .catch((requestError: Error) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchCasOperons(filters, geneRange, page, pageSize, controller.signal)
      .then((data) => {
        setResult(data);
        setExpandedRowId(null);
      })
      .catch((requestError: Error) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters, geneRange, page, pageSize]);

  function toggleFilter(field: string, value: string) {
    setLoading(true);
    setError(null);
    closeProtein();
    setFilters((current) => {
      const values = current[field] ?? [];
      const nextValues = values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];
      const next = { ...current };
      if (nextValues.length > 0) next[field] = nextValues; // if some filed has no values, then delete the field
      else delete next[field];
      return next;
    });
    setPage(1);
  }

  function resetFilters() {
    setLoading(true);
    setError(null);
    closeProtein();
    setFilters({});
    if (filterData) {
      setGeneRange([filterData.gene_count.minimum, filterData.gene_count.maximum]);
    }
    setPage(1);
  }

  async function openProtein(proteinHeader: string) {
    detailRequest.current?.abort();
    const controller = new AbortController();
    detailRequest.current = controller;
    setSelectedProtein(null);
    setDetailLoading(true);
    setDetailError(null);

    try {
      const protein = await fetchCasProtein(proteinHeader, "cctyper", controller.signal);
      if (!controller.signal.aborted) setSelectedProtein(protein);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name !== "AbortError") {
        setDetailError(requestError.message);
      }
    } finally {
      if (detailRequest.current === controller) {
        detailRequest.current = null;
        setDetailLoading(false);
      }
    }
  }

  function closeProtein() {
    detailRequest.current?.abort();
    detailRequest.current = null;
    setSelectedProtein(null);
    setDetailLoading(false);
    setDetailError(null);
  }

  const bounds: [number, number] | null = filterData
    ? [filterData.gene_count.minimum, filterData.gene_count.maximum]
    : null;

  return (
      <div className={styles.browseLayout}>
        <FilterTab
          ariaLabel="Cas operon filters"
          sections={FILTER_SECTIONS}
          facets={filterData?.facets ?? {}}
          selected={filters}
          geneBounds={bounds}
          geneRange={geneRange}
          loading={!filterData && loading}
          onToggle={toggleFilter}
          onGeneRangeChange={(range) => {
            setLoading(true);
            setError(null);
            closeProtein();
            setGeneRange(range);
            setPage(1);
          }}
          onReset={resetFilters}
        />
        {selectedProtein ? (
          <ProteinDetailView
            protein={selectedProtein}
            loading={detailLoading}
            error={detailError}
            onBack={closeProtein}
          />
        ) : detailLoading || detailError ? (
          <section className={styles.proteinDetailCard}>
            <div className={styles.proteinDetailToolbar}>
              <button type="button" onClick={closeProtein}>
                <ArrowLeft aria-hidden="true" size={15} />
                Back
              </button>
              <span>Protein detail</span>
            </div>
            <div
              className={styles.tableState}
              role={detailLoading ? "status" : "alert"}
            >
              {detailLoading ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  <strong>Loading protein detail…</strong>
                </>
              ) : (
                <>
                  <strong>Unable to load protein detail</strong>
                  <span>{detailError}</span>
                </>
              )}
            </div>
          </section>
        ) : (
          <BrowseTable
          entityNoun="operons"
          columns={COLUMNS}
          gridTemplate="minmax(260px, 2.3fr) 110px minmax(320px, 2.4fr)"
          rows={result.items}
          total={result.total}
          page={page}
          pageSize={pageSize}
          loading={loading}
          error={error}
          expandedRowId={expandedRowId}
          getRowId={(operon) => operon.operon_header}
          renderExpanded={(operon) => (
            <OperonDetails operon={operon} onOpenProtein={openProtein} />
          )}
          onToggleRow={(operon) => {
            setExpandedRowId((current) =>
              current === operon.operon_header ? null : operon.operon_header,
            );
          }}
          onPageChange={(nextPage) => {
            setLoading(true);
            setError(null);
            closeProtein();
            setPage(nextPage);
          }}
          onPageSizeChange={(size) => {
            setLoading(true);
            setError(null);
            closeProtein();
            setPageSize(size);
            setPage(1);
          }}
          />
        )}
      </div>
  );
}
