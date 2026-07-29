/**
 * Zone Abris — 6 rangées × 2 cases.
 * 2 rangées du bas toujours visibles ; 4 abris installables (du plus bas) débloquent chacun 2 cases.
 *
 * Les meeples ne retiennent pas de position : un compteur est affiché
 * empilé vers le bas de l’écran (remplissage bas → haut).
 */

export const SHELTER_ROW_COUNT = 6;
export const SHELTER_SLOTS_PER_ROW = 2;
/** Rangées du bas toujours ouvertes au démarrage. */
export const SHELTER_BASE_VISIBLE_ROWS = 2;
/** Nombre d’abris encore installables (rangées couvertes initiales). */
export const SHELTER_MAX_INSTALLS = 4;
/** Colons en abri au démarrage. */
export const DEFAULT_SHELTER_COLONISTS = 3;

export type ShelterSlotRef = {
  row: number;
  slot: number;
};

export function clampSheltersInstalled(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(SHELTER_MAX_INSTALLS, Math.max(0, Math.round(n)));
}

/** Nombre de rangées encore couvertes en partant du haut. */
export function coveredTopRows(sheltersInstalled: number): number {
  return SHELTER_MAX_INSTALLS - clampSheltersInstalled(sheltersInstalled);
}

/** Rangée visible (non couverte) ? */
export function isShelterRowVisible(
  row: number,
  sheltersInstalled = 0,
): boolean {
  return (
    row >= coveredTopRows(sheltersInstalled) && row < SHELTER_ROW_COUNT
  );
}

/**
 * Prochaine rangée installable = la plus basse encore couverte.
 * `null` si les 4 abris sont déjà installés.
 */
export function nextInstallableShelterRow(
  sheltersInstalled: number,
): number | null {
  const installed = clampSheltersInstalled(sheltersInstalled);
  if (installed >= SHELTER_MAX_INSTALLS) return null;
  return coveredTopRows(installed) - 1;
}

/** Capacité d’abris visibles (cases). */
export function visibleShelterCapacity(sheltersInstalled = 0): number {
  const top = coveredTopRows(sheltersInstalled);
  return (SHELTER_ROW_COUNT - top) * SHELTER_SLOTS_PER_ROW;
}

/**
 * Ordre d’affichage / remplissage : bas → haut, gauche → droite (cases visibles).
 * Les meeples restent le plus bas possible à l’écran (row 5 en bas du grid).
 */
export function visibleShelterSlotsBottomUp(
  sheltersInstalled = 0,
): ShelterSlotRef[] {
  const slots: ShelterSlotRef[] = [];
  const top = coveredTopRows(sheltersInstalled);
  for (let row = SHELTER_ROW_COUNT - 1; row >= top; row--) {
    for (let slot = 0; slot < SHELTER_SLOTS_PER_ROW; slot++) {
      slots.push({ row, slot });
    }
  }
  return slots;
}

export function clampShelterColonists(
  count: number,
  sheltersInstalled = 0,
): number {
  const cap = visibleShelterCapacity(sheltersInstalled);
  if (!Number.isFinite(count)) return 0;
  return Math.min(cap, Math.max(0, Math.round(count)));
}

export function normalizeShelterColonists(
  raw: unknown,
  sheltersInstalled = 0,
  legacyOccupied?: unknown,
): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return clampShelterColonists(raw, sheltersInstalled);
  }
  if (Array.isArray(legacyOccupied)) {
    return clampShelterColonists(legacyOccupied.length, sheltersInstalled);
  }
  return clampShelterColonists(DEFAULT_SHELTER_COLONISTS, sheltersInstalled);
}

/** Cases occupées dérivées du compteur (empilées vers le bas de l’écran). */
export function occupiedShelterSlotKeys(
  shelterColonists: number,
  sheltersInstalled = 0,
): Set<string> {
  const n = clampShelterColonists(shelterColonists, sheltersInstalled);
  const occupied = new Set<string>();
  const order = visibleShelterSlotsBottomUp(sheltersInstalled);
  for (let i = 0; i < n; i++) {
    const ref = order[i];
    if (!ref) break;
    occupied.add(shelterSlotKey(ref.row, ref.slot));
  }
  return occupied;
}

export function shelterSlotKey(row: number, slot: number): string {
  return `${row}:${slot}`;
}

export function normalizeSheltersInstalled(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw)
    ? clampSheltersInstalled(raw)
    : 0;
}
