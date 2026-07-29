/** Coordonnées axiales (q, r). */
export type HexCoord = {
  q: number;
  r: number;
};

export type HexOrientation = "pointy" | "flat";

export type HexCell = HexCoord & {
  id: string;
  /** Index de rendu (ordre stable). */
  index: number;
};

export function hexId(hex: HexCoord): string {
  return `${hex.q},${hex.r}`;
}

export function parseHexId(id: string): HexCoord {
  const [q, r] = id.split(",").map(Number);
  return { q: q ?? 0, r: r ?? 0 };
}

/** Distance cube / axiale entre deux hexes. */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  const as = -a.q - a.r;
  const bs = -b.q - b.r;
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(as - bs));
}

/** Les 6 voisins axiaux. */
export const HEX_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function hexNeighbors(hex: HexCoord): HexCoord[] {
  return HEX_DIRECTIONS.map((d) => ({ q: hex.q + d.q, r: hex.r + d.r }));
}

/** Grille hexagonale pleine de rayon `radius` (centre inclus). */
export function buildHexDisk(radius: number): HexCell[] {
  const cells: HexCell[] = [];
  let index = 0;
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      cells.push({ q, r, id: hexId({ q, r }), index: index++ });
    }
  }
  return cells;
}

export function cellsFromCoords(coords: HexCoord[]): HexCell[] {
  return coords.map((c, index) => ({ ...c, id: hexId(c), index }));
}

/**
 * Position pixel du centre d’un hex.
 * `size` = distance centre → sommet.
 * `yScale` < 1 aplatit la grille verticalement (hexes + espacement).
 */
export function hexToPixel(
  hex: HexCoord,
  size: number,
  orientation: HexOrientation = "pointy",
  yScale = 1,
): { x: number; y: number } {
  if (orientation === "flat") {
    return {
      x: size * ((3 / 2) * hex.q),
      y: size * ((Math.sqrt(3) / 2) * hex.q + Math.sqrt(3) * hex.r) * yScale,
    };
  }
  return {
    x: size * (Math.sqrt(3) * hex.q + (Math.sqrt(3) / 2) * hex.r),
    y: size * ((3 / 2) * hex.r) * yScale,
  };
}

/** Sommets d’un hex centré en (cx, cy). */
export function hexVertices(
  cx: number,
  cy: number,
  size: number,
  orientation: HexOrientation = "pointy",
  yScale = 1,
): { x: number; y: number }[] {
  const startDeg = orientation === "flat" ? 0 : -30;
  const verts: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i + startDeg);
    verts.push({
      x: cx + size * Math.cos(angle),
      y: cy + size * Math.sin(angle) * yScale,
    });
  }
  return verts;
}

/** Sommets d’un hex en attribut SVG `points`. */
export function hexPolygonPoints(
  cx: number,
  cy: number,
  size: number,
  orientation: HexOrientation = "pointy",
  yScale = 1,
): string {
  return hexVertices(cx, cy, size, orientation, yScale)
    .map((v) => `${v.x},${v.y}`)
    .join(" ");
}

function quantize(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function edgeKey(
  a: { x: number; y: number },
  b: { x: number; y: number },
): string {
  const ax = quantize(a.x);
  const ay = quantize(a.y);
  const bx = quantize(b.x);
  const by = quantize(b.y);
  if (ax < bx || (ax === bx && ay <= by)) {
    return `${ax},${ay}|${bx},${by}`;
  }
  return `${bx},${by}|${ax},${ay}`;
}

export type HexEdge = { x1: number; y1: number; x2: number; y2: number };

/**
 * Arêtes uniques d’une grille (une seule ligne entre deux hexes adjacents).
 * Les centres utilisent la même `size` que `hexToPixel` pour un calage exact.
 */
export function uniqueHexEdges(
  cells: HexCoord[],
  size: number,
  orientation: HexOrientation = "pointy",
  yScale = 1,
): HexEdge[] {
  const seen = new Set<string>();
  const edges: HexEdge[] = [];
  for (const cell of cells) {
    const { x, y } = hexToPixel(cell, size, orientation, yScale);
    const verts = hexVertices(x, y, size, orientation, yScale);
    for (let i = 0; i < 6; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % 6];
      const key = edgeKey(a, b);
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
  }
  return edges;
}

/** ViewBox ajustée aux cellules présentes. */
export function hexViewBoxForCells(
  cells: HexCoord[],
  size: number,
  orientation: HexOrientation,
  padding = 10,
  yScale = 1,
) {
  if (cells.length === 0) {
    return { width: size * 4, height: size * 4, minX: -size * 2, minY: -size * 2 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const cell of cells) {
    const { x, y } = hexToPixel(cell, size, orientation, yScale);
    // Enveloppe approximative du hex
    const hw = orientation === "flat" ? size : (Math.sqrt(3) / 2) * size;
    const hh =
      (orientation === "flat" ? (Math.sqrt(3) / 2) * size : size) * yScale;
    minX = Math.min(minX, x - hw);
    maxX = Math.max(maxX, x + hw);
    minY = Math.min(minY, y - hh);
    maxY = Math.max(maxY, y + hh);
  }

  return {
    minX: minX - padding,
    minY: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}
