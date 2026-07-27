/**
 * Zone Abris — remplissage toujours depuis le bas.
 * Grille : 6 rangées × 2 cases (gauche → droite).
 * Les 4 rangées du haut sont couvertes / verrouillées.
 */

export const SHELTER_ROW_COUNT = 6;
export const SHELTER_SLOTS_PER_ROW = 2;
/** Nombre de rangées couvertes en partant du haut. */
export const SHELTER_COVERED_TOP_ROWS = 4;

export type ShelterSlotRef = {
  row: number;
  slot: number;
};

/** Rangée visible (non couverte) ? */
export function isShelterRowVisible(row: number): boolean {
  return row >= SHELTER_COVERED_TOP_ROWS && row < SHELTER_ROW_COUNT;
}

/**
 * Ordre de remplissage : bas → haut, et dans chaque rangée gauche → droite.
 * Uniquement les cases visibles.
 */
export function visibleShelterSlotsBottomUp(): ShelterSlotRef[] {
  const slots: ShelterSlotRef[] = [];
  for (let row = SHELTER_ROW_COUNT - 1; row >= SHELTER_COVERED_TOP_ROWS; row--) {
    for (let slot = 0; slot < SHELTER_SLOTS_PER_ROW; slot++) {
      slots.push({ row, slot });
    }
  }
  return slots;
}

/** Place `count` occupants dans les premières cases visibles libres (depuis le bas). */
export function placeInVisibleShelters(count: number): Set<string> {
  const occupied = new Set<string>();
  const order = visibleShelterSlotsBottomUp();
  for (let i = 0; i < Math.min(count, order.length); i++) {
    const { row, slot } = order[i];
    occupied.add(shelterSlotKey(row, slot));
  }
  return occupied;
}

export function shelterSlotKey(row: number, slot: number): string {
  return `${row}:${slot}`;
}
