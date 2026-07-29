/** Classe 1 = bleue (1–12), classe 2 = rouge (13–24). */
export type BlueprintClass = 1 | 2;

export type BlueprintCardId = number;

/** Emplacement marché : carte ou vide (conserve la place). */
export type BlueprintSlot = BlueprintCardId | null;

export type BlueprintMarketState = {
  /** Ligne 1 — 6 emplacements (bleues au début / LSS2). */
  rowBlue: BlueprintSlot[];
  /** Ligne 2 — 6 emplacements (rouges). */
  rowRed: BlueprintSlot[];
  /** Pioche non encore servie. */
  deck: BlueprintCardId[];
  /** Cartes retirées sans avoir été prises. */
  discarded: BlueprintCardId[];
  /** Phase de service : 1 (début), 2 (LSS≥2), 3 (LSS≥3). */
  dealPhase: 1 | 2 | 3;
};

export const BLUEPRINT_CLASS1_IDS: BlueprintCardId[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
];
export const BLUEPRINT_CLASS2_IDS: BlueprintCardId[] = [
  13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
];

export const BLUEPRINT_ROW_SIZE = 6;

export function blueprintClass(id: BlueprintCardId): BlueprintClass {
  return id >= 13 ? 2 : 1;
}

function emptyRow(): BlueprintSlot[] {
  return Array.from({ length: BLUEPRINT_ROW_SIZE }, () => null);
}

function fillRow(cards: BlueprintCardId[]): BlueprintSlot[] {
  const row = emptyRow();
  for (let i = 0; i < Math.min(cards.length, BLUEPRINT_ROW_SIZE); i += 1) {
    row[i] = cards[i]!;
  }
  return row;
}

function occupiedIds(row: BlueprintSlot[]): BlueprintCardId[] {
  return row.filter((id): id is BlueprintCardId => id != null);
}

function padRow(row: BlueprintSlot[]): BlueprintSlot[] {
  const next = row.slice(0, BLUEPRINT_ROW_SIZE);
  while (next.length < BLUEPRINT_ROW_SIZE) next.push(null);
  return next;
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

function takeRandomOfClass(
  deck: BlueprintCardId[],
  klass: BlueprintClass,
  count: number,
): BlueprintCardId[] {
  const indices = deck
    .map((id, index) => ({ id, index }))
    .filter(({ id }) => blueprintClass(id) === klass);
  shuffleInPlace(indices);
  const picked = indices.slice(0, Math.min(count, indices.length));
  picked.sort((a, b) => b.index - a.index);
  const result: BlueprintCardId[] = [];
  for (const { index, id } of picked) {
    deck.splice(index, 1);
    result.push(id);
  }
  shuffleInPlace(result);
  return result;
}

function discardRows(state: BlueprintMarketState): void {
  state.discarded.push(...occupiedIds(state.rowBlue), ...occupiedIds(state.rowRed));
  state.rowBlue = emptyRow();
  state.rowRed = emptyRow();
}

/** Début : 6 bleues sur la 1ʳᵉ ligne. */
export function createInitialBlueprintMarket(): BlueprintMarketState {
  const class1 = shuffleInPlace([...BLUEPRINT_CLASS1_IDS]);
  const class2 = shuffleInPlace([...BLUEPRINT_CLASS2_IDS]);
  const dealt = class1.splice(0, BLUEPRINT_ROW_SIZE);
  return {
    rowBlue: fillRow(dealt),
    rowRed: emptyRow(),
    deck: [...class1, ...class2],
    discarded: [],
    dealPhase: 1,
  };
}

/**
 * LSS → 2 : retire les cartes restantes du marché (les prises restent aux joueurs),
 * sert les bleues restantes sur la 1ʳᵉ ligne et 6 rouges sur la 2ᵉ.
 */
export function advanceBlueprintsToPhase2(
  state: BlueprintMarketState,
): BlueprintMarketState {
  if (state.dealPhase >= 2) return state;
  const next = cloneMarket(state);
  discardRows(next);
  next.rowBlue = fillRow(takeRandomOfClass(next.deck, 1, BLUEPRINT_ROW_SIZE));
  next.rowRed = fillRow(takeRandomOfClass(next.deck, 2, BLUEPRINT_ROW_SIZE));
  next.dealPhase = 2;
  return next;
}

/**
 * LSS → 3 : retire les bleues restantes ; remplit les 6 premières places
 * avec les rouges restantes de la pioche ; la 2ᵉ ligne garde ses places.
 */
export function advanceBlueprintsToPhase3(
  state: BlueprintMarketState,
): BlueprintMarketState {
  if (state.dealPhase >= 3) return state;
  const next =
    state.dealPhase < 2 ? advanceBlueprintsToPhase2(state) : cloneMarket(state);
  next.discarded.push(...occupiedIds(next.rowBlue));
  next.rowBlue = fillRow(takeRandomOfClass(next.deck, 2, BLUEPRINT_ROW_SIZE));
  next.dealPhase = 3;
  return next;
}

export function syncBlueprintsForLss(
  state: BlueprintMarketState,
  lssLevel: number,
): BlueprintMarketState {
  const target: 1 | 2 | 3 = lssLevel >= 3 ? 3 : lssLevel >= 2 ? 2 : 1;
  let next = state;
  if (target >= 2 && next.dealPhase < 2) next = advanceBlueprintsToPhase2(next);
  if (target >= 3 && next.dealPhase < 3) next = advanceBlueprintsToPhase3(next);
  return next;
}

/** Prend une carte : l’emplacement devient vide, les autres gardent leur place. */
export function takeBlueprintFromMarket(
  market: BlueprintMarketState,
  cardId: BlueprintCardId,
  owned: BlueprintCardId[],
): { market: BlueprintMarketState; owned: BlueprintCardId[] } | null {
  if (owned.includes(cardId)) return null;
  const next = cloneMarket(market);
  const blueIdx = next.rowBlue.indexOf(cardId);
  if (blueIdx >= 0) {
    next.rowBlue[blueIdx] = null;
    return { market: next, owned: [...owned, cardId] };
  }
  const redIdx = next.rowRed.indexOf(cardId);
  if (redIdx >= 0) {
    next.rowRed[redIdx] = null;
    return { market: next, owned: [...owned, cardId] };
  }
  return null;
}

export function cloneMarket(state: BlueprintMarketState): BlueprintMarketState {
  return {
    rowBlue: [...state.rowBlue],
    rowRed: [...state.rowRed],
    deck: [...state.deck],
    discarded: [...state.discarded],
    dealPhase: state.dealPhase,
  };
}

/** Grille d’affichage 2×6 : ligne 1 puis ligne 2 (null = emplacement vide). */
export function blueprintDisplaySlots(
  state: Pick<BlueprintMarketState, "rowBlue" | "rowRed">,
): BlueprintSlot[] {
  return [...padRow(state.rowBlue), ...padRow(state.rowRed)];
}

function asSlots(value: unknown): BlueprintSlot[] {
  if (!Array.isArray(value)) return emptyRow();
  const slots: BlueprintSlot[] = value.map((n) => {
    if (n == null) return null;
    if (typeof n !== "number" || !Number.isFinite(n)) return null;
    const id = Math.round(n);
    return id >= 1 && id <= 24 ? id : null;
  });
  return padRow(slots);
}

function asIds(value: unknown): BlueprintCardId[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
    .map((n) => Math.round(n))
    .filter((n) => n >= 1 && n <= 24);
}

export function normalizeBlueprintMarket(raw: unknown): BlueprintMarketState {
  if (!raw || typeof raw !== "object") return createInitialBlueprintMarket();
  const data = raw as Partial<BlueprintMarketState> & {
    market?: unknown;
  };
  const dealPhaseRaw =
    typeof data.dealPhase === "number" ? Math.round(data.dealPhase) : 1;
  const dealPhase: 1 | 2 | 3 =
    dealPhaseRaw >= 3 ? 3 : dealPhaseRaw >= 2 ? 2 : 1;

  let rowBlue = asSlots(data.rowBlue);
  let rowRed = asSlots(data.rowRed);

  // Migration ancien champ `market` plat (compact, sans trous).
  if (
    occupiedIds(rowBlue).length === 0 &&
    occupiedIds(rowRed).length === 0 &&
    Array.isArray(data.market)
  ) {
    const flat = asIds(data.market);
    rowBlue = fillRow(flat.filter((id) => blueprintClass(id) === 1));
    rowRed = fillRow(flat.filter((id) => blueprintClass(id) === 2));
  }

  const deck = asIds(data.deck);
  const discarded = asIds(data.discarded);
  if (
    occupiedIds(rowBlue).length === 0 &&
    occupiedIds(rowRed).length === 0 &&
    deck.length === 0 &&
    discarded.length === 0
  ) {
    return createInitialBlueprintMarket();
  }
  return { rowBlue, rowRed, deck, discarded, dealPhase };
}

export function normalizeBlueprintOwned(raw: unknown): BlueprintCardId[] {
  return asIds(raw);
}
