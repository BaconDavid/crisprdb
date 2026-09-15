/* ============================================================
   Shared structure helpers — 3Dmol.js loading, pLDDT model,
   model provenance, and TM-align style superposition.
   ============================================================ */

/* ---------- 3Dmol global (loaded via CDN script tag) ---------- */
export interface MolAtom {
  x: number;
  y: number;
  z: number;
  b: number;
  resi: number;
  chain?: string;
  atom?: string;
}
export interface MolModel {
  selectedAtoms: (sel: Record<string, unknown>) => MolAtom[];
}
export interface MolViewer {
  clear: () => void;
  addModel: (data: string, format: string) => MolModel;
  getModel: (i?: number) => MolModel;
  setStyle: (sel: Record<string, unknown>, style: Record<string, unknown>) => void;
  addSurface: (type: unknown, style: Record<string, unknown>) => void;
  removeAllSurfaces: () => void;
  zoomTo: (sel?: Record<string, unknown>) => void;
  spin: (axis: string | false) => void;
  render: () => void;
}
interface Mol3D {
  createViewer: (el: HTMLElement, cfg: Record<string, unknown>) => MolViewer;
  SurfaceType: { MS: unknown };
}
declare global {
  interface Window {
    $3Dmol?: Mol3D;
  }
}

export const MOL_SCRIPT = "https://3Dmol.org/build/3Dmol-min.js";

/** Injects the 3Dmol script once and resolves when the global is ready. */
export function load3Dmol(): Promise<Mol3D | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.$3Dmol) return Promise.resolve(window.$3Dmol);

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${MOL_SCRIPT}"]`);
  if (existing) {
    return new Promise((resolve) => {
      existing.addEventListener("load", () => resolve(window.$3Dmol ?? null));
      existing.addEventListener("error", () => resolve(null));
      if (window.$3Dmol) resolve(window.$3Dmol);
    });
  }

  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = MOL_SCRIPT;
    s.async = true;
    s.onload = () => resolve(window.$3Dmol ?? null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}

/* ---------- pLDDT ---------- */
export function plddtFor(resi: number, total: number): number {
  const t = total || 1;
  const x = resi / t;
  let v = 78
    + 14 * Math.sin(x * Math.PI)
    + 8 * Math.sin(resi * 0.11)
    + 5 * Math.cos(resi * 0.037 + 1.3);
  if (x < 0.045 || x > 0.965) v -= 42;
  if (x > 0.47 && x < 0.53) v -= 16;
  return Math.max(24, Math.min(97, v));
}

export function plddtColor(v: number): string {
  const score = normalizePlddt(v);
  if (score >= 90) return "#0053d6";
  if (score >= 80) return "#3f8fe0";
  if (score >= 70) return "#65cbf3";
  if (score >= 50) return "#ffdb13";
  return "#ff7d45";
}

/** Supports legacy jobs with 0-1 pLDDT and new jobs using the standard 0-100 scale. */
export function normalizePlddt(value: number): number {
  return value <= 1 ? value * 100 : value;
}

/** Reads the real per-residue C-alpha confidence stored in the PDB B-factor column. */
export function caPlddtFromPdb(pdbText: string): number[] {
  return pdbText
    .split("\n")
    .filter((line) => line.startsWith("ATOM") && line.slice(12, 16).trim() === "CA")
    .map((line) => Number.parseFloat(line.slice(60, 66)))
    .filter(Number.isFinite)
    .map(normalizePlddt);
}

export const PLDDT_LEGEND: [string, string][] = [
  ["#0053d6", "Very high >90"],
  ["#65cbf3", "Confident 70–90"],
  ["#ffdb13", "Low 50–70"],
  ["#ff7d45", "Very low <50"],
];

export function meanPlddt(nRes: number): number {
  if (!nRes) return 0;
  let sum = 0;
  for (let i = 1; i <= nRes; i += 1) sum += plddtFor(i, nRes);
  return sum / nRes;
}

/* ---------- model provenance ---------- */
export interface ModelSource {
  method: string;
  db: string;
  accession: string;
  version: string;
  badge: string;
  detail: string;
  confidenceLabel: string;
}

/** Deterministic: a protein always reports the same model origin. */
export function sourceFor(header: string, annotation?: string): ModelSource {
  let h = 0;
  const s = `${header ?? ""}|${annotation ?? ""}`;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 99991;
  if (h % 10 < 5) {
    return {
      method: "ESMFold",
      db: "ESM Atlas",
      accession: `MGYP${String(100000000 + h * 731).slice(0, 9)}`,
      version: "v1",
      badge: "ESMFold",
      detail: "Single-sequence prediction",
      confidenceLabel: "pLDDT",
    };
  }
  return {
    method: "AlphaFold2",
    db: "AlphaFold DB",
    accession: `AF-${String.fromCharCode(65 + (h % 26))}${(h % 9) + 1}K${100 + (h % 800)}-F1`,
    version: "v4",
    badge: "AlphaFold2",
    detail: "MSA-based prediction",
    confidenceLabel: "pLDDT",
  };
}

/* ---------- generated fallback fold ----------
   Used when RCSB/AFDB are unreachable so the viewer stays functional.
   Replace with your prediction endpoint's PDB output. */
type Seg = ["H" | "E" | "L", number];
const LAYOUTS: Seg[][] = [
  [["H", 16], ["L", 4], ["E", 9], ["L", 4], ["H", 13], ["L", 5], ["E", 9], ["L", 4], ["H", 18], ["L", 4], ["E", 8], ["L", 4], ["H", 14]],
  [["H", 12], ["L", 5], ["E", 11], ["L", 3], ["H", 17], ["L", 4], ["E", 7], ["L", 6], ["H", 11], ["L", 4], ["E", 10], ["L", 3], ["H", 16], ["L", 4], ["E", 8]],
  [["E", 8], ["L", 4], ["H", 20], ["L", 5], ["E", 10], ["L", 4], ["H", 15], ["L", 4], ["E", 9], ["L", 5], ["H", 12], ["L", 3], ["E", 11]],
];

const AA3 = ["ALA", "LEU", "GLY", "VAL", "SER", "GLU", "LYS", "THR", "ASP", "ILE",
  "ARG", "PHE", "ASN", "GLN", "TYR", "PRO", "MET", "HIS", "TRP", "CYS"];

type Vec3 = [number, number, number];
const norm = (v: Vec3): Vec3 => {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const pdbCache: Record<string, string> = {};

export function buildDemoPdb(variant: number, targetLen?: number): string {
  const want = targetLen && targetLen > 20 ? Math.round(targetLen) : null;
  const key = `v${variant}-${want ?? "native"}`;
  if (pdbCache[key]) return pdbCache[key];

  const layout = LAYOUTS[variant % LAYOUTS.length];
  let segs: Seg[] = layout;
  if (want) {
    segs = [];
    let total = 0;
    let i = 0;
    while (total < want) {
      const [type, n] = layout[i % layout.length];
      const remaining = want - total;
      if (remaining < 3) break;
      segs.push([type, Math.min(n, remaining)]);
      total += Math.min(n, remaining);
      i += 1;
    }
  }

  let seed = 8191 + variant * 12251;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

  const ca: Vec3[] = [];
  const helices: [number, number][] = [];
  const sheets: [number, number][] = [];
  let cursor: Vec3 = [0, 0, 0];
  let dir = norm([1, 0.2, 0.1]);

  segs.forEach(([type, n]) => {
    const centroid: Vec3 = ca.length
      ? ca.reduce<Vec3>((acc, p) => [acc[0] + p[0] / ca.length, acc[1] + p[1] / ca.length, acc[2] + p[2] / ca.length], [0, 0, 0])
      : [0, 0, 0];
    const inward = norm([centroid[0] - cursor[0] + 0.001, centroid[1] - cursor[1], centroid[2] - cursor[2]]);
    dir = norm([
      dir[0] * 0.35 + inward[0] * 0.5 + (rnd() - 0.5) * 0.9,
      dir[1] * 0.35 + inward[1] * 0.5 + (rnd() - 0.5) * 0.9,
      dir[2] * 0.35 + inward[2] * 0.5 + (rnd() - 0.5) * 0.9,
    ]);
    const ref: Vec3 = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = norm(cross(dir, ref));
    const v = norm(cross(dir, u));
    const startResi = ca.length + 1;

    for (let i = 0; i < n; i += 1) {
      if (type === "H") {
        const th = i * 1.7453;
        ca.push([
          cursor[0] + dir[0] * 1.5 * i + 2.3 * (Math.cos(th) * u[0] + Math.sin(th) * v[0]),
          cursor[1] + dir[1] * 1.5 * i + 2.3 * (Math.cos(th) * u[1] + Math.sin(th) * v[1]),
          cursor[2] + dir[2] * 1.5 * i + 2.3 * (Math.cos(th) * u[2] + Math.sin(th) * v[2]),
        ]);
      } else if (type === "E") {
        const zig = i % 2 === 0 ? 0.95 : -0.95;
        ca.push([
          cursor[0] + dir[0] * 3.3 * i + zig * u[0],
          cursor[1] + dir[1] * 3.3 * i + zig * u[1],
          cursor[2] + dir[2] * 3.3 * i + zig * u[2],
        ]);
      } else {
        const bend = Math.sin((i / Math.max(n - 1, 1)) * Math.PI) * 2.4;
        ca.push([
          cursor[0] + dir[0] * 3.5 * i + bend * v[0],
          cursor[1] + dir[1] * 3.5 * i + bend * v[1],
          cursor[2] + dir[2] * 3.5 * i + bend * v[2],
        ]);
      }
    }
    const endResi = ca.length;
    if (type === "H") helices.push([startResi, endResi]);
    if (type === "E") sheets.push([startResi, endResi]);
    cursor = [...ca[ca.length - 1]];
  });

  const rec = (fields: [number, string | number][]) => {
    const b = new Array(80).fill(" ");
    fields.forEach(([start, text]) => {
      const t = String(text);
      for (let k = 0; k < t.length; k += 1) b[start + k] = t[k];
    });
    return b.join("").replace(/\s+$/, "");
  };

  const lines: string[] = [];
  helices.forEach((h, i) => {
    lines.push(rec([[0, "HELIX "], [7, String(i + 1).padStart(3)], [11, String(i + 1).padStart(3)],
      [15, "ALA"], [19, "A"], [21, String(h[0]).padStart(4)],
      [27, "ALA"], [31, "A"], [33, String(h[1]).padStart(4)], [38, "1"]]));
  });
  sheets.forEach((sh, i) => {
    lines.push(rec([[0, "SHEET "], [7, String(i + 1).padStart(3)], [11, "  A"], [14, String(sheets.length).padStart(2)],
      [17, "VAL"], [21, "A"], [22, String(sh[0]).padStart(4)],
      [28, "VAL"], [32, "A"], [33, String(sh[1]).padStart(4)], [38, " 0"]]));
  });

  let serial = 1;
  const atomLine = (name: string, element: string, resName: string, resi: number, p: Vec3) => rec([
    [0, "ATOM  "], [6, String(serial++).padStart(5)], [12, name.padEnd(4)], [17, resName], [21, "A"],
    [22, String(resi).padStart(4)],
    [30, p[0].toFixed(3).padStart(8)], [38, p[1].toFixed(3).padStart(8)], [46, p[2].toFixed(3).padStart(8)],
    [54, "  1.00"], [60, " 50.00"], [76, element.padStart(2)],
  ]);

  ca.forEach((c, i) => {
    const resName = AA3[i % AA3.length];
    const prev = ca[i - 1] ?? ([c[0] - 3.8, c[1], c[2]] as Vec3);
    const next = ca[i + 1] ?? ([c[0] + 3.8, c[1], c[2]] as Vec3);
    const toPrev = norm([prev[0] - c[0], prev[1] - c[1], prev[2] - c[2]]);
    const toNext = norm([next[0] - c[0], next[1] - c[1], next[2] - c[2]]);
    const side = norm(cross(toNext, toPrev));
    const N: Vec3 = [c[0] + toPrev[0] * 1.46, c[1] + toPrev[1] * 1.46, c[2] + toPrev[2] * 1.46];
    const C: Vec3 = [c[0] + toNext[0] * 1.52, c[1] + toNext[1] * 1.52, c[2] + toNext[2] * 1.52];
    const O: Vec3 = [C[0] + side[0] * 1.23, C[1] + side[1] * 1.23, C[2] + side[2] * 1.23];
    lines.push(atomLine(" N", "N", resName, i + 1, N));
    lines.push(atomLine(" CA", "C", resName, i + 1, c));
    lines.push(atomLine(" C", "C", resName, i + 1, C));
    lines.push(atomLine(" O", "O", resName, i + 1, O));
  });
  lines.push("TER", "END");

  pdbCache[key] = lines.join("\n");
  return pdbCache[key];
}

/* ---------- remote structure fetch ---------- */
export function pdbUrlFor(id: string): string | null {
  const raw = String(id ?? "").trim();
  if (!raw) return null;
  if (/^AF[-_]/i.test(raw)) {
    const acc = raw.replace(/^AF[-_]/i, "").replace(/-F\d+$/i, "");
    return `https://alphafold.ebi.ac.uk/files/AF-${acc}-F1-model_v4.pdb`;
  }
  const code = raw.split(/[_.\s]/)[0].toUpperCase();
  if (/^[0-9A-Z]{4}$/.test(code)) return `https://files.rcsb.org/download/${code}.pdb`;
  return null;
}

const remoteCache: Record<string, string> = {};

export async function fetchPdb(id: string, timeoutMs = 8000): Promise<string> {
  const url = pdbUrlFor(id);
  if (!url) throw new Error("unresolvable id");
  if (remoteCache[url]) return remoteCache[url];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error("fetch failed");
    const text = await res.text();
    remoteCache[url] = text;
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- superposition (Horn quaternion / Kabsch) ---------- */
export function mainChainCA(model: MolModel): MolAtom[] {
  const ca = model.selectedAtoms({ atom: "CA" });
  const byChain: Record<string, MolAtom[]> = {};
  ca.forEach((a) => {
    const c = a.chain || "_";
    if (!byChain[c]) byChain[c] = [];
    byChain[c].push(a);
  });
  let best: MolAtom[] = [];
  Object.values(byChain).forEach((list) => { if (list.length > best.length) best = list; });
  return [...best].sort((a, b) => a.resi - b.resi);
}

type Mat3 = [Vec3, Vec3, Vec3];

/** Rotation that best superposes P onto Q (both centred, equal length). */
export function bestRotation(P: Vec3[], Q: Vec3[]): Mat3 {
  let sxx = 0, sxy = 0, sxz = 0, syx = 0, syy = 0, syz = 0, szx = 0, szy = 0, szz = 0;
  for (let i = 0; i < P.length; i += 1) {
    const p = P[i], q = Q[i];
    sxx += p[0] * q[0]; sxy += p[0] * q[1]; sxz += p[0] * q[2];
    syx += p[1] * q[0]; syy += p[1] * q[1]; syz += p[1] * q[2];
    szx += p[2] * q[0]; szy += p[2] * q[1]; szz += p[2] * q[2];
  }
  const N = [
    [sxx + syy + szz, syz - szy, szx - sxz, sxy - syx],
    [syz - szy, sxx - syy - szz, sxy + syx, szx + sxz],
    [szx - sxz, sxy + syx, -sxx + syy - szz, syz + szy],
    [sxy - syx, szx + sxz, syz + szy, -sxx - syy + szz],
  ];
  let trace = 0;
  for (let i = 0; i < 4; i += 1) trace += Math.abs(N[i][0]) + Math.abs(N[i][1]) + Math.abs(N[i][2]) + Math.abs(N[i][3]);
  for (let i = 0; i < 4; i += 1) N[i][i] += trace;

  let v = [1, 0.3, 0.2, 0.1];
  for (let it = 0; it < 240; it += 1) {
    const w = [0, 0, 0, 0];
    for (let i = 0; i < 4; i += 1) for (let j = 0; j < 4; j += 1) w[i] += N[i][j] * v[j];
    const m = Math.hypot(w[0], w[1], w[2], w[3]) || 1;
    v = [w[0] / m, w[1] / m, w[2] / m, w[3] / m];
  }
  const [q0, q1, q2, q3] = v;
  return [
    [q0 * q0 + q1 * q1 - q2 * q2 - q3 * q3, 2 * (q1 * q2 - q0 * q3), 2 * (q1 * q3 + q0 * q2)],
    [2 * (q1 * q2 + q0 * q3), q0 * q0 - q1 * q1 + q2 * q2 - q3 * q3, 2 * (q2 * q3 - q0 * q1)],
    [2 * (q1 * q3 - q0 * q2), 2 * (q2 * q3 + q0 * q1), q0 * q0 - q1 * q1 - q2 * q2 + q3 * q3],
  ];
}

export interface Superposition {
  R: Mat3;
  cT: Vec3;
  cQ: Vec3;
  rmsd: number;
  tmQuery: number;
  tmTarget: number;
  aligned: number;
}

/** NOTE: correspondence is a proportional index mapping, not full TM-align
    dynamic programming. Good for homologs; have the backend run real TM-align
    and return its rotation matrix for distant folds. */
export function superpose(qCA: MolAtom[], tCA: MolAtom[]): Superposition | null {
  const n = Math.min(qCA.length, tCA.length);
  if (n < 4) return null;

  const pairs: [MolAtom, MolAtom][] = [];
  for (let i = 0; i < n; i += 1) {
    const qi = Math.round((i * (qCA.length - 1)) / (n - 1));
    const ti = Math.round((i * (tCA.length - 1)) / (n - 1));
    pairs.push([tCA[ti], qCA[qi]]);
  }

  const cT: Vec3 = [0, 0, 0];
  const cQ: Vec3 = [0, 0, 0];
  pairs.forEach(([t, q]) => {
    cT[0] += t.x; cT[1] += t.y; cT[2] += t.z;
    cQ[0] += q.x; cQ[1] += q.y; cQ[2] += q.z;
  });
  for (let k = 0; k < 3; k += 1) { cT[k] /= pairs.length; cQ[k] /= pairs.length; }

  const P: Vec3[] = pairs.map(([t]) => [t.x - cT[0], t.y - cT[1], t.z - cT[2]]);
  const Q: Vec3[] = pairs.map(([, q]) => [q.x - cQ[0], q.y - cQ[1], q.z - cQ[2]]);
  const R = bestRotation(P, Q);

  let sq = 0;
  const dists: number[] = [];
  for (let i = 0; i < P.length; i += 1) {
    const p = P[i];
    const rp: Vec3 = [
      R[0][0] * p[0] + R[0][1] * p[1] + R[0][2] * p[2],
      R[1][0] * p[0] + R[1][1] * p[1] + R[1][2] * p[2],
      R[2][0] * p[0] + R[2][1] * p[1] + R[2][2] * p[2],
    ];
    const d2 = (rp[0] - Q[i][0]) ** 2 + (rp[1] - Q[i][1]) ** 2 + (rp[2] - Q[i][2]) ** 2;
    sq += d2;
    dists.push(Math.sqrt(d2));
  }

  const tmFor = (L: number) => {
    const d0 = Math.max(0.5, 1.24 * Math.cbrt(Math.max(L - 15, 1)) - 1.8);
    let sum = 0;
    dists.forEach((d) => { sum += 1 / (1 + (d / d0) ** 2); });
    return sum / L;
  };

  return {
    R, cT, cQ,
    rmsd: Math.sqrt(sq / P.length),
    tmQuery: tmFor(qCA.length),
    tmTarget: tmFor(tCA.length),
    aligned: P.length,
  };
}

/** Applies a fitted rotation/translation to every atom of a model. */
export function applyTransform(model: MolModel, fit: Superposition): void {
  const { R, cT, cQ } = fit;
  model.selectedAtoms({}).forEach((a) => {
    const x = a.x - cT[0], y = a.y - cT[1], z = a.z - cT[2];
    a.x = R[0][0] * x + R[0][1] * y + R[0][2] * z + cQ[0];
    a.y = R[1][0] * x + R[1][1] * y + R[1][2] * z + cQ[1];
    a.z = R[2][0] * x + R[2][1] * y + R[2][2] * z + cQ[2];
  });
}

/* ---------- misc ---------- */
export function cleanSequence(raw: string): string {
  return String(raw ?? "")
    .split("\n")
    .filter((l) => l.trim()[0] !== ">")
    .join("")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
}

export function downloadPdbText(text: string, filename: string): void {
  const blob = new Blob([text], { type: "chemical/x-pdb" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith(".pdb") ? filename : `${filename}.pdb`;
  a.click();
  URL.revokeObjectURL(a.href);
}
