import { cellsFromCoords, type HexCoord } from "./hexGrid";
import type { LssTokenResource } from "./ColonyResourceIcon";

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

/** Colonnes de gauche à droite (q croissant). */
export const TECH_COLUMN_QS = [-2, -1, 0, 1, 2, 3] as const;
export type TechColumnQ = (typeof TECH_COLUMN_QS)[number];

export type TechColumnCost =
  | { type: "free" }
  | { type: "any_lss" }
  | { type: "oxygene" }
  | { type: "oxygene_any_lss" }
  | { type: "oxygene_cristal" };

/** Coût pour entrer / être dans chaque colonne (1 → 6, gauche → droite). */
export const TECH_COLUMN_COSTS: Record<TechColumnQ, TechColumnCost> = {
  [-2]: { type: "free" },
  [-1]: { type: "any_lss" },
  [0]: { type: "oxygene" },
  [1]: { type: "oxygene" },
  [2]: { type: "oxygene_any_lss" },
  [3]: { type: "oxygene_cristal" },
};

export const TECH_COLUMN_COST_LABELS: Record<TechColumnCost["type"], string> = {
  free: "Gratuit",
  any_lss: "1 ressource (énergie, eau, plante ou oxygène)",
  oxygene: "1 oxygène",
  oxygene_any_lss: "1 oxygène + 1 ressource (énergie, eau, plante ou oxygène)",
  oxygene_cristal: "1 oxygène + 1 cristal",
};

/** Points de victoire par colonne (1 → 6, gauche → droite). */
export const TECH_COLUMN_VP: Record<TechColumnQ, number> = {
  [-2]: 1,
  [-1]: 2,
  [0]: 3,
  [1]: 4,
  [2]: 5,
  [3]: 9,
};

export type TechColumnPayResource = LssTokenResource | "cristal";
