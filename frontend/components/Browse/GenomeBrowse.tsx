"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";

import { OperonDetails } from "./CasOperonBrowse";
import { FilterTab, type FilterSection } from "./FilterTab";
import { ProteinDetailView } from "./ProteinBrowse";
import { BrowseTable, type BrowseColumn } from "./Tabel";
import {
  fetchCasGenomeFilters,
  fetchCasGenomes,
  fetchCasProtein,
  toggleBrowseFilter,
  type BrowseFilters,
  type CasGenome,
  type CasGenomeFilterData,
  type CasGenomeListResponse,
  type CasOperon,
  type CasProtein,
} from "./api";
import styles from "@/css/Browse.module.css";

const FILTER_SECTIONS: FilterSection[] = [
  {
    id: "source",
    title: "Data Source",
    groups: [{ field: "source", label: "Source database" }],
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

const COLUMNS: BrowseColumn<CasGenome>[] = [
  {
    key: "genome_header",
    label: "genome_header",
    render: (genome) => <span className={styles.operonId}>{genome.genome_header}</span>,
  },
  {
    key: "source",
    label: "source",
    render: (genome) => <strong className={styles.proteinName}>{display(genome.source)}</strong>,
  },
  {
    key: "n_operons",
    label: "n_operons",
    render: (genome) => <strong>{genome.n_operons}</strong>,
  },
  {
    key: "country",
    label: "country",
    render: (genome) => <span>{display(genome.country)}</span>,
  },
];

function display(value: string | number | null) {
  return value === null || value === "" ? "NA" : value;
}

function operonComponents(operon: CasOperon) {
  return operon.genes
    .map((gene) => gene.annotation_name || gene.protein_header)
    .join(" | ");
}

function GenomeDetails({
  genome,
  onOpenOperon,
}: {
  genome: CasGenome;
  onOpenOperon: (operon: CasOperon) => void;
}) {
  const metadata = [
    ["Species", display(genome.lineage_species)],
    ["Strain", display(genome.lineage_strain)],
    ["Host", display(genome.host)],
    ["Country", display(genome.country)],
    ["BioProject", display(genome.bioproject)],
    [
      "Contig length",
      genome.contig_length === null
        ? "NA"
        : `${genome.contig_length.toLocaleString()} bp`,
    ],
  ];
  const lineage = [
    genome.lineage_domain,
    genome.lineage_phylum,
    genome.lineage_class,
    genome.lineage_order,
    genome.lineage_family,
    genome.lineage_genus,
    genome.lineage_species,
    genome.lineage_strain,
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

      <section className={styles.genomeOperons}>
        <h3>Cas operons on this contig ({genome.n_operons})</h3>
        {genome.operons.length === 0 ? (
          <p className={styles.noGeneData}>No Cas operons are linked to this contig.</p>
        ) : (
          <div className={styles.genomeOperonTable}>
            <div className={styles.genomeOperonHeader}>
              <span>operon_header</span>
              <span>subtype</span>
              <span>cas_pro_component</span>
            </div>
            {genome.operons.map((operon) => (
              <button
                type="button"
                key={operon.operon_header}
                className={styles.genomeOperonRow}
                onClick={() => onOpenOperon(operon)}
              >
                <span className={styles.operonId}>{operon.operon_header}</span>
                <strong>{display(operon.crispr_subtype)}</strong>
                <span className={styles.componentList}>
                  {operonComponents(operon) || "No protein records"}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function GenomeBrowse() {
  const [filterData, setFilterData] = useState<CasGenomeFilterData | null>(null);
  const [filters, setFilters] = useState<BrowseFilters>({});
  const [operonRange, setOperonRange] = useState<[number, number] | null>(null);
  const [result, setResult] = useState<CasGenomeListResponse>({
    items: [], total: 0, page: 1, page_size: 10,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [selectedOperon, setSelectedOperon] = useState<CasOperon | null>(null);
  const [selectedProtein, setSelectedProtein] = useState<CasProtein | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchCasGenomeFilters(filters, operonRange, controller.signal)
      .then((data) => {
        setFilterData(data);
        setOperonRange((current) => current ?? [
          data.operon_count.minimum,
          data.operon_count.maximum,
        ]);
      })
      .catch((requestError: Error) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setFilterLoading(false);
      });
    return () => controller.abort();
  }, [filters, operonRange]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCasGenomes(filters, operonRange, page, pageSize, controller.signal)
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
  }, [filters, operonRange, page, pageSize]);

  function resetDetail() {
    setSelectedOperon(null);
    setSelectedProtein(null);
    setDetailLoading(false);
    setDetailError(null);
  }

  function toggleFilter(field: string, value: string) {
    setLoading(true);
    setFilterLoading(true);
    setError(null);
    resetDetail();
    setFilters((current) => toggleBrowseFilter(current, field, value));
    setPage(1);
  }

  async function openProtein(proteinHeader: string) {
    setSelectedProtein(null);
    setDetailLoading(true);
    setDetailError(null);
    try {
      setSelectedProtein(await fetchCasProtein(proteinHeader, "cctyper"));
    } catch (requestError) {
      setDetailError(
        requestError instanceof Error ? requestError.message : "Unable to load protein detail.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  const bounds: [number, number] | null = filterData
    ? [filterData.operon_count.minimum, filterData.operon_count.maximum]
    : null;

  return (
    <div className={styles.browseLayout}>
      <FilterTab
        ariaLabel="Genome and contig filters"
        sections={FILTER_SECTIONS}
        facets={filterData?.facets ?? {}}
        selected={filters}
        range={bounds && operonRange ? {
          bounds,
          value: operonRange,
          title: "Cas operons per contig",
          hint: "Number of Cas operons detected on the contig.",
        } : null}
        loading={filterLoading}
        onToggle={toggleFilter}
        onRangeChange={(range) => {
          setLoading(true);
          setFilterLoading(true);
          setError(null);
          resetDetail();
          setOperonRange(range);
          setPage(1);
        }}
        onReset={() => {
          setLoading(true);
          setFilterLoading(true);
          setError(null);
          resetDetail();
          setFilters({});
          if (filterData) {
            setOperonRange([
              filterData.operon_count.minimum,
              filterData.operon_count.maximum,
            ]);
          }
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
      ) : detailLoading || detailError ? (
        <section className={styles.proteinDetailCard}>
          <div className={styles.proteinDetailToolbar}>
            <button
              type="button"
              onClick={() => {
                setDetailLoading(false);
                setDetailError(null);
              }}
            >
              <ArrowLeft aria-hidden="true" size={15} />
              Back
            </button>
            <span>Protein detail</span>
          </div>
          <div className={styles.tableState} role={detailLoading ? "status" : "alert"}>
            {detailLoading ? "Loading protein detail…" : detailError}
          </div>
        </section>
      ) : selectedOperon ? (
        <article className={styles.proteinDetailCard}>
          <div className={styles.proteinDetailToolbar}>
            <button type="button" onClick={() => setSelectedOperon(null)}>
              <ArrowLeft aria-hidden="true" size={15} />
              Back
            </button>
            <span>Cas operon detail</span>
          </div>
          <div className={styles.genomeOperonDetailBody}>
            <h2>{selectedOperon.operon_header}</h2>
            <OperonDetails operon={selectedOperon} onOpenProtein={openProtein} />
          </div>
        </article>
      ) : (
        <BrowseTable
          entityNoun="contigs"
          columns={COLUMNS}
          gridTemplate="minmax(280px, 2.6fr) 150px 150px 130px"
          rows={result.items}
          total={result.total}
          page={page}
          pageSize={pageSize}
          loading={loading}
          error={error}
          expandedRowId={expandedRowId}
          getRowId={(genome) => genome.genome_header}
          renderExpanded={(genome) => (
            <GenomeDetails genome={genome} onOpenOperon={setSelectedOperon} />
          )}
          onToggleRow={(genome) => {
            setExpandedRowId((current) =>
              current === genome.genome_header ? null : genome.genome_header,
            );
          }}
          onPageChange={(nextPage) => {
            setLoading(true);
            setError(null);
            resetDetail();
            setPage(nextPage);
          }}
          onPageSizeChange={(size) => {
            setLoading(true);
            setError(null);
            resetDetail();
            setPageSize(size);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}
