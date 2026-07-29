/**
 * Tuiles techno — 8 types piochés au hasard dans le module Techno (orbite).
 *
 * Coûts par ligne (haut → bas) :
 * - ligne 0 : 1 oxygène + 1 ressource parmi énergie / eau / plante / oxygène
 * - ligne 1 : 1 oxygène
 * - ligne 2 : gratuit
 */

import type { PlayerResources } from "./colonyResources";
import { hexId, hexNeighbors, hexToPixel, type HexCoord } from "./hexGrid";
import { TECH_HEX_COORDS } from "./techMap";

export const TECH_KINDS = [
  "minerai",
  "energie",
  "eau",
  "plante",
  "oxygene",
  "rover",
  "fusee",
  "batiment",
] as const;

export type TechKind = (typeof TECH_KINDS)[number];

export const TECH_KIND_LABELS: Record<TechKind, string> = {
  minerai: "Minerai",
  energie: "Énergie",
  eau: "Eau",
  plante: "Plante",
  oxygene: "Oxygène",
  rover: "Rover",
  fusee: "Fusée",
  batiment: "Bâtiment",
};

export const TECH_SLOT_COUNT = TECH_KINDS.length;

/** Disposition du module Techno orbite : 3 / 3 / 2. */
export const TECH_MARKET_ROW_COUNTS = [3, 3, 2] as const;

/** Ressources payables en plus de l’O₂ sur la ligne haute. */
export const TECH_TOP_PAY_RESOURCES = [
  "energie",
  "eau",
  "plante",
  "oxygene",
] as const;
export type TechTopPayResource = (typeof TECH_TOP_PAY_RESOURCES)[number];

export type TechMarketState = {
  /** 8 cases ; `null` = déjà prise. */
  slots: (TechKind | null)[];
};

/** Tuile techno placée sur la carte perso. */
export type TechPlacement = {
  kind: TechKind;
  q: number;
  r: number;
};

/** Nombre / cases de départ (uniquement les 2 hexes les plus à gauche). */
export const TECH_LEFT_PLACE_COUNT = 2;

/** Cases d’entrée fixes — seules places où l’on peut poser une techno. */
export const TECH_START_SLOTS: HexCoord[] = [...TECH_HEX_COORDS]
  .sort((a, b) => a.q - b.q || a.r - b.r)
  .slice(0, TECH_LEFT_PLACE_COUNT);

export function isTechKind(value: unknown): value is TechKind {
  return (
    typeof value === "string" &&
    (TECH_KINDS as readonly string[]).includes(value)
  );
}

export function isTechTopPayResource(
  value: unknown,
): value is TechTopPayResource {
  return (
    typeof value === "string" &&
    (TECH_TOP_PAY_RESOURCES as readonly string[]).includes(value)
  );
}

export function techKindClass(kind: TechKind): string {
  return `om-tech--${kind}`;
}

/** Index de ligne (0 = haut) pour un slot du marché. */
export function techMarketRowForSlot(slotIndex: number): number {
  let remaining = slotIndex;
  for (let row = 0; row < TECH_MARKET_ROW_COUNTS.length; row++) {
    const count = TECH_MARKET_ROW_COUNTS[row]!;
    if (remaining < count) return row;
    remaining -= count;
  }
  return TECH_MARKET_ROW_COUNTS.length - 1;
}

export function techMarketRowForKind(
  market: TechMarketState,
  kind: TechKind,
): number | null {
  const index = market.slots.findIndex((s) => s === kind);
  if (index < 0) return null;
  return techMarketRowForSlot(index);
}

/** Peut-on payer le coût de la ligne ? (`payExtra` requis pour la ligne haute). */
export function canAffordTechRow(
  resources: PlayerResources,
  row: number,
  payExtra?: TechTopPayResource | null,
): boolean {
  const oxy = resources.oxygene ?? 0;
  if (row === 2) return true;
  if (row === 1) return oxy >= 1;
  if (row === 0) {
    if (!payExtra || !isTechTopPayResource(payExtra)) return false;
    if (payExtra === "oxygene") return oxy >= 2;
    return oxy >= 1 && (resources[payExtra] ?? 0) >= 1;
  }
  return false;
}

/** Au moins une combinaison de paiement possible pour la ligne. */
export function canAffordAnyTechRow(
  resources: PlayerResources,
  row: number,
): boolean {
  if (row === 2) return true;
  if (row === 1) return canAffordTechRow(resources, row);
  return TECH_TOP_PAY_RESOURCES.some((r) => canAffordTechRow(resources, 0, r));
}

export function affordableTopPayOptions(
  resources: PlayerResources,
): TechTopPayResource[] {
  return TECH_TOP_PAY_RESOURCES.filter((r) =>
    canAffordTechRow(resources, 0, r),
  );
}

/**
 * Déduit le coût d’une ligne. Retourne null si impayable.
 * `payExtra` obligatoire pour la ligne 0.
 */
export function payTechRowCost(
  resources: PlayerResources,
  row: number,
  payExtra?: TechTopPayResource | null,
): PlayerResources | null {
  if (!canAffordTechRow(resources, row, payExtra)) return null;
  const next = { ...resources };
  if (row === 2) return next;
  if (row === 1) {
    next.oxygene -= 1;
    return next;
  }
  const extra = payExtra!;
  next.oxygene -= 1;
  next[extra] -= 1;
  return next;
}

function shuffleTechs(seed: number): TechKind[] {
  const items = [...TECH_KINDS];
  let s = seed | 0;
  for (let i = items.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    const j = (s >>> 0) % (i + 1);
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

/** Pioche aléatoire (seed) des 8 tuiles dans les 8 cases. */
export function dealTechMarket(seed = Date.now() & 0xffffffff): TechMarketState {
  return { slots: shuffleTechs(seed) };
}

export function createInitialTechMarket(): TechMarketState {
  return dealTechMarket(Date.now() & 0xffffffff);
}

export function normalizeTechMarket(raw: unknown): TechMarketState {
  if (!raw || typeof raw !== "object") return createInitialTechMarket();
  const data = raw as Partial<TechMarketState>;
  if (!Array.isArray(data.slots) || data.slots.length !== TECH_SLOT_COUNT) {
    return createInitialTechMarket();
  }

  const seen = new Set<TechKind>();
  const slots: (TechKind | null)[] = [];
  for (const item of data.slots) {
    if (item == null) {
      slots.push(null);
      continue;
    }
    if (!isTechKind(item) || seen.has(item)) {
      return createInitialTechMarket();
    }
    seen.add(item);
    slots.push(item);
  }
  // Toutes les techs doivent apparaître au plus une fois (prises = null).
  if (slots.length !== TECH_SLOT_COUNT) return createInitialTechMarket();
  return { slots };
}

export function normalizeTechOwned(raw: unknown): TechPlacement[] {
  if (!Array.isArray(raw)) return [];
  const next: TechPlacement[] = [];
  const seenKinds = new Set<TechKind>();
  const seenCells = new Set<string>();

  // Ancien format : liste de kinds → cases de départ à gauche (max 2).
  if (raw.every((item) => typeof item === "string")) {
    const kinds = raw.filter(isTechKind);
    for (let i = 0; i < kinds.length && i < TECH_START_SLOTS.length; i++) {
      const kind = kinds[i]!;
      if (seenKinds.has(kind)) continue;
      seenKinds.add(kind);
      const cell = TECH_START_SLOTS[i]!;
      next.push({ kind, q: cell.q, r: cell.r });
    }
    return next;
  }

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const data = item as Partial<TechPlacement>;
    if (!isTechKind(data.kind)) continue;
    if (seenKinds.has(data.kind)) continue;
    if (typeof data.q !== "number" || typeof data.r !== "number") continue;
    if (!Number.isInteger(data.q) || !Number.isInteger(data.r)) continue;
    const id = hexId({ q: data.q, r: data.r });
    if (!TECH_HEX_COORDS.some((c) => hexId(c) === id)) continue;
    if (seenCells.has(id)) continue;
    seenKinds.add(data.kind);
    seenCells.add(id);
    next.push({ kind: data.kind, q: data.q, r: data.r });
  }
  return next;
}

/**
 * Cases de départ encore libres.
 * Si les 2 sont occupées → aucune prise de techno possible.
 */
export function leftmostAvailableTechSlots(
  owned: TechPlacement[],
): HexCoord[] {
  const occupied = new Set(owned.map((p) => hexId(p)));
  return TECH_START_SLOTS.filter((c) => !occupied.has(hexId(c)));
}

export function isValidTechPlacement(
  owned: TechPlacement[],
  q: number,
  r: number,
): boolean {
  return leftmostAvailableTechSlots(owned).some((c) => c.q === q && c.r === r);
}

export function ownedTechKinds(owned: TechPlacement[]): TechKind[] {
  return owned.map((p) => p.kind);
}

function isTechMapCell(q: number, r: number): boolean {
  return TECH_HEX_COORDS.some((c) => c.q === q && c.r === r);
}

/**
 * Cases voisines à droite libres (haut et/ou bas).
 * Le joueur choisit parmi ces destinations.
 */
export function techAdvanceRightTargets(
  owned: TechPlacement[],
  kind: TechKind,
): HexCoord[] {
  const tech = owned.find((p) => p.kind === kind);
  if (!tech) return [];
  const occupied = new Set(
    owned.filter((p) => p.kind !== kind).map((p) => hexId(p)),
  );
  const from = hexToPixel(tech, 1, "flat");
  const targets: HexCoord[] = [];

  for (const n of hexNeighbors(tech)) {
    if (!isTechMapCell(n.q, n.r)) continue;
    if (occupied.has(hexId(n))) continue;
    const pix = hexToPixel(n, 1, "flat");
    if (pix.x <= from.x + 1e-6) continue;
    targets.push(n);
  }

  // Haut d’abord (y plus petit à l’écran), puis bas.
  return targets.sort((a, b) => {
    const ay = hexToPixel(a, 1, "flat").y;
    const by = hexToPixel(b, 1, "flat").y;
    return ay - by || a.q - b.q || a.r - b.r;
  });
}

export function canAdvanceTechRight(
  owned: TechPlacement[],
  kind: TechKind,
): boolean {
  return techAdvanceRightTargets(owned, kind).length > 0;
}

export function isValidTechAdvance(
  owned: TechPlacement[],
  kind: TechKind,
  q: number,
  r: number,
): boolean {
  return techAdvanceRightTargets(owned, kind).some(
    (c) => c.q === q && c.r === r,
  );
}

/** Fait évoluer une techno vers une case voisine à droite (haut ou bas). */
export function advanceTechRight(
  owned: TechPlacement[],
  kind: TechKind,
  q: number,
  r: number,
): TechPlacement[] | null {
  if (!isValidTechAdvance(owned, kind, q, r)) return null;
  return owned.map((p) => (p.kind === kind ? { ...p, q, r } : p));
}

/**
 * Prend une tuile techno du marché et la place sur (q, r).
 */
export function takeTechFromMarket(
  market: TechMarketState,
  owned: TechPlacement[],
  kind: TechKind,
  q: number,
  r: number,
): { market: TechMarketState; owned: TechPlacement[]; row: number } | null {
  const index = market.slots.findIndex((s) => s === kind);
  if (index < 0) return null;
  if (owned.some((p) => p.kind === kind)) return null;
  if (!isValidTechPlacement(owned, q, r)) return null;
  const slots = market.slots.map((s, i) => (i === index ? null : s));
  return {
    market: { slots },
    owned: [...owned, { kind, q, r }],
    row: techMarketRowForSlot(index),
  };
}
