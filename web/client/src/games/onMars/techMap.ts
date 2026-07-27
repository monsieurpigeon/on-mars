import { cellsFromCoords, type HexCoord } from "./hexGrid";

/**
 * Carte Tech — colony-base-centered (flat).
 */
export const TECH_HEX_COORDS: HexCoord[] = [
  { q: 0, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: -1, r: 2 },
  { q: -2, r: 1 },
  { q: -2, r: 2 },
  { q: 1, r: 1 },
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 2, r: -1 },
  { q: 2, r: 0 },
  { q: 3, r: -1 },
];

export const TECH_HEX_CELLS = cellsFromCoords(TECH_HEX_COORDS);
