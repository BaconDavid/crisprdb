export const homeIntro = {
  eyebrow: "Public CRISPR resource",
  title: "CRISPR Database",
  description:
    "A curated portal for browsing CRISPR-Cas operons, genome context, subtype distribution, and related proteins.",
};

export const homeMetrics = [
  {
    accentColor: "#2563eb",
    detail: "Synthetic v0 dataset",
    icon: "operons",
    label: "Cas Operons",
    value: "100",
  },
  {
    accentColor: "#10b981",
    detail: "Example assemblies",
    icon: "genomes",
    label: "Genome / Contigs",
    value: "64",
  },
  {
    accentColor: "#8b5cf6",
    detail: "Mock origin metadata",
    icon: "countries",
    label: "Source Countries",
    value: "12",
  },
  {
    accentColor: "#f97316",
    detail: "Predicted proteins",
    icon: "proteins",
    label: "CRISPR-related Proteins",
    value: "438",
  },
];

export const classDistribution = [
  { label: "Class 1", value: 80, color: "#1d4ed8" },
  { label: "Class 2", value: 20, color: "#f97316" },
];

export const typeDistribution = [
  { label: "Type I", value: 45, color: "#2563eb" },
  { label: "Type II", value: 9, color: "#f97316" },
  { label: "Type III", value: 25, color: "#10b981" },
  { label: "Type IV", value: 10, color: "#8b5cf6" },
  { label: "Type V", value: 7, color: "#ec4899" },
  { label: "Type VI", value: 4, color: "#eab308" },
];

export const subtypePieCharts = [
  {
    title: "Type I",
    description: "Class 1 subtype split",
    items: [
      { label: "Type I-A", value: 12, color: "#1d4ed8" },
      { label: "Type I-B", value: 8, color: "#3b82f6" },
      { label: "Type I-C", value: 15, color: "#60a5fa" },
      { label: "Type I-E", value: 10, color: "#93c5fd" },
    ],
  },
  {
    title: "Type II",
    description: "Class 2 subtype split",
    items: [
      { label: "Type II-A", value: 4, color: "#c2410c" },
      { label: "Type II-B", value: 2, color: "#f97316" },
      { label: "Type II-C", value: 3, color: "#fdba74" },
    ],
  },
  {
    title: "Type III",
    description: "Class 1 subtype split",
    items: [
      { label: "Type III-A", value: 8, color: "#047857" },
      { label: "Type III-B", value: 7, color: "#10b981" },
      { label: "Type III-C", value: 5, color: "#6ee7b7" },
      { label: "Type III-D", value: 5, color: "#a7f3d0" },
    ],
  },
  {
    title: "Type IV",
    description: "Class 1 subtype split",
    items: [
      { label: "Type IV-A", value: 6, color: "#7c3aed" },
      { label: "Type IV-B", value: 4, color: "#c4b5fd" },
    ],
  },
  {
    title: "Type V",
    description: "Class 2 subtype split",
    items: [
      { label: "Type V-A", value: 3, color: "#db2777" },
      { label: "Type V-B", value: 2, color: "#ec4899" },
      { label: "Type V-C", value: 2, color: "#f9a8d4" },
    ],
  },
  {
    title: "Type VI",
    description: "Class 2 subtype split",
    items: [
      { label: "Type VI-A", value: 2, color: "#ca8a04" },
      { label: "Type VI-B", value: 1, color: "#eab308" },
      { label: "Type VI-C", value: 1, color: "#fde68a" },
    ],
  },
];

export const sampleLocations = [
  { city: "Shenzhen", country: "China", count: 18 },
  { city: "Boston", country: "United States", count: 12 },
  { city: "Cambridge", country: "United Kingdom", count: 10 },
  { city: "Berlin", country: "Germany", count: 9 },
  { city: "Tokyo", country: "Japan", count: 8 },
  { city: "Singapore", country: "Singapore", count: 7 },
];

export const countrySampleCounts = [
  { country: "China", count: 18 },
  { country: "United States of America", label: "United States", count: 12 },
  { country: "United Kingdom", count: 10 },
  { country: "Germany", count: 9 },
  { country: "Japan", count: 8 },
  { country: "Singapore", count: 7 },
  { country: "France", count: 6 },
  { country: "Canada", count: 6 },
  { country: "Australia", count: 5 },
  { country: "Brazil", count: 4 },
  { country: "South Africa", count: 3 },
  { country: "India", count: 2 },
];
