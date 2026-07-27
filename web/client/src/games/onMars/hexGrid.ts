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
export function hexPolygonPoints(
  cx: number,
  cy: number,
  size: number,
  orientation: HexOrientation = "pointy",
  yScale = 1,
): string {
  const startDeg = orientation === "flat" ? 0 : -30;
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i + startDeg);
    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle) * yScale;
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join(" ");
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
