"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { Coordinator } from "@uwdata/mosaic-core";
import type { AsyncDuckDB } from "@duckdb/duckdb-wasm";

const EmbeddingAtlas = dynamic(
  () =>
    import("embedding-atlas/react").then((module) => module.EmbeddingAtlas),
  {
    ssr: false,
    loading: () => (
      <div style={messageStyle} role="status" aria-live="polite">
        Loading the interactive embedding view…
      </div>
    ),
  },
);

const TABLE_NAME = "mock_protein_embeddings";

interface MockProteinEmbedding extends Record<string, unknown> {
  id: number;
  protein_header: string;
  annotation_name: string;
  search_text: string;
  crispr_type: string;
  length: number;
  x: number;
  y: number;
}

interface EmbeddingAtlasPanelProps {
  height?: number | string;
}

const CLUSTERS = [
  { annotation: "Cas9", type: "Type II", x: -4.4, y: 2.8, spread: 0.72 },
  { annotation: "Cas12a", type: "Type V", x: 3.9, y: 3.3, spread: 0.82 },
  { annotation: "Cas13", type: "Type VI", x: 4.6, y: -3.1, spread: 0.76 },
  { annotation: "Cas3", type: "Type I", x: -3.8, y: -3.6, spread: 0.88 },
  { annotation: "Cas7", type: "Type I", x: -0.5, y: 0.2, spread: 1.02 },
  { annotation: "Cas10", type: "Type III", x: 0.2, y: 5.2, spread: 0.7 },
  { annotation: "Unannotated", type: "Unknown", x: 0.8, y: -5.1, spread: 1.2 },
] as const;

function seededRandom(seed: number) {
  let value = seed >>> 0;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function normalSample(random: () => number) {
  const first = Math.max(random(), Number.EPSILON);
  const second = random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function createMockProteinEmbeddings(): MockProteinEmbedding[] {
  const random = seededRandom(20261020);
  const pointsPerCluster = 48;

  return CLUSTERS.flatMap((cluster, clusterIndex) =>
    Array.from({ length: pointsPerCluster }, (_, pointIndex) => {
      const id = clusterIndex * pointsPerCluster + pointIndex;
      const proteinHeader = `CRISPRDB_PRO_${String(id + 1).padStart(5, "0")}`;
      const length = Math.round(180 + random() * 1_220);

      return {
        id,
        protein_header: proteinHeader,
        annotation_name: cluster.annotation,
        search_text: `${proteinHeader} ${cluster.annotation} ${cluster.type}`,
        crispr_type: cluster.type,
        length,
        x: cluster.x + normalSample(random) * cluster.spread,
        y: cluster.y + normalSample(random) * cluster.spread,
      };
    }),
  );
}

const MOCK_PROTEIN_EMBEDDINGS = createMockProteinEmbeddings();

export default function EmbeddingAtlasPanel({
  height = "min(78vh, 820px)",
}: EmbeddingAtlasPanelProps) {
  const [coordinator, setCoordinator] = useState<Coordinator | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let instance: Coordinator | null = null;
    let database: AsyncDuckDB | null = null;

    async function initialize() {
      try {
        const [{ Coordinator, wasmConnector }, { loadObjects }, duckdb] =
          await Promise.all([
            import("@uwdata/mosaic-core"),
            import("@uwdata/mosaic-sql"),
            import("@duckdb/duckdb-wasm"),
          ]);

        const bundle = await duckdb.selectBundle({
          mvp: {
            mainModule: "/duckdb/duckdb-mvp.wasm",
            mainWorker: "/duckdb/duckdb-browser-mvp.worker.js",
          },
        });
        const worker = new Worker(bundle.mainWorker!);

        database = new duckdb.AsyncDuckDB(
          new duckdb.VoidLogger(),
          worker,
        );
        await database.instantiate(bundle.mainModule, bundle.pthreadWorker);

        instance = new Coordinator();
        instance.databaseConnector(wasmConnector({ duckdb: database }));
        await instance.exec(
          loadObjects(TABLE_NAME, MOCK_PROTEIN_EMBEDDINGS, {
            replace: true,
          }),
        );

        if (!cancelled) {
          setCoordinator(instance);
        }
      } catch (reason) {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "The embedding view could not be initialized.",
          );
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
      instance?.clear();
      void database?.terminate();
    };
  }, []);

  return (
    <section style={panelStyle} aria-labelledby="protein-embedding-title">
      <header style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Interactive protein landscape</p>
          <h2 id="protein-embedding-title" style={titleStyle}>
            Protein Embedding Atlas
          </h2>
          <p style={descriptionStyle}>
            Mock UMAP projection of {MOCK_PROTEIN_EMBEDDINGS.length} proteins
            across {CLUSTERS.length} annotation groups. Pan, zoom, search, or
            brush points to explore the simulated dataset.
          </p>
        </div>
        <div style={statusBadgeStyle} aria-label="Data source: simulated data">
          <span style={statusDotStyle} aria-hidden="true" />
          Simulated data
        </div>
      </header>

      <div style={{ ...viewerFrameStyle, height }}>
        {error ? (
          <div style={errorStyle} role="alert">
            <strong>Unable to load Embedding Atlas</strong>
            <span>{error}</span>
          </div>
        ) : coordinator ? (
          <EmbeddingAtlas
            coordinator={coordinator}
            data={{
              table: TABLE_NAME,
              id: "id",
              projection: { x: "x", y: "y" },
              text: "search_text",
            }}
            colorScheme="light"
            defaultChartsConfig={{
              include: [
                "protein_header",
                "annotation_name",
                "crispr_type",
                "length",
              ],
            }}
            embeddingViewConfig={{
              pointSize: 2.5,
            }}
          />
        ) : (
          <div style={messageStyle} role="status" aria-live="polite">
            Preparing the in-browser protein dataset…
          </div>
        )}
      </div>
    </section>
  );
}

const panelStyle: CSSProperties = {
  width: "100%",
  padding: 20,
  border: "1px solid #dbeafe",
  borderRadius: 16,
  background: "#ffffff",
  boxShadow: "0 12px 32px rgba(30, 64, 175, 0.08)",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 24,
  marginBottom: 16,
};

const eyebrowStyle: CSSProperties = {
  margin: "0 0 5px",
  color: "#1e40af",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: "clamp(1.25rem, 2vw, 1.75rem)",
  lineHeight: 1.2,
};

const descriptionStyle: CSSProperties = {
  maxWidth: 760,
  margin: "8px 0 0",
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.6,
};

const statusBadgeStyle: CSSProperties = {
  display: "inline-flex",
  flexShrink: 0,
  alignItems: "center",
  gap: 8,
  minHeight: 32,
  padding: "6px 10px",
  border: "1px solid #bfdbfe",
  borderRadius: 999,
  background: "#eff6ff",
  color: "#1e3a8a",
  fontSize: 12,
  fontWeight: 700,
};

const statusDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#2563eb",
};

const viewerFrameStyle: CSSProperties = {
  minHeight: 480,
  overflow: "hidden",
  border: "1px solid #dbeafe",
  borderRadius: 12,
  background: "#f8fafc",
};

const messageStyle: CSSProperties = {
  display: "grid",
  width: "100%",
  height: "100%",
  minHeight: 480,
  placeItems: "center",
  padding: 24,
  color: "#475569",
  fontSize: 14,
};

const errorStyle: CSSProperties = {
  display: "flex",
  width: "100%",
  height: "100%",
  minHeight: 480,
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: 24,
  color: "#991b1b",
  fontSize: 14,
  textAlign: "center",
};
