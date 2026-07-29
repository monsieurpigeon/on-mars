/**
 * Scientifiques colonie — 6 types fixes (ordre d’affichage / cases marché).
 */

export const SCIENTIST_RESOURCES = [
  "minerai",
  "energie",
  "eau",
  "plante",
  "oxygene",
  "abri",
] as const;

export type ScientistResource = (typeof SCIENTIST_RESOURCES)[number];

export const SCIENTIST_RESOURCE_LABELS: Record<ScientistResource, string> = {
  minerai: "Minerai",
  energie: "Énergie",
  eau: "Eau",
  plante: "Plante",
  oxygene: "Oxygène",
  abri: "Abri",
};

export const SCIENTIST_SLOT_COUNT = SCIENTIST_RESOURCES.length;

export type ScientistMarketState = {
  /** 6 cases fixes ; `null` = déjà pris (place conservée). */
  slots: (ScientistResource | null)[];
};

export function scientistResourceClass(resource: ScientistResource): string {
  return `om-res--${resource}`;
}

export function isScientistResource(value: unknown): value is ScientistResource {
  return (
    typeof value === "string" &&
    (SCIENTIST_RESOURCES as readonly string[]).includes(value)
  );
}

export function createInitialScientistMarket(): ScientistMarketState {
  return { slots: [...SCIENTIST_RESOURCES] };
}

export function normalizeScientistMarket(raw: unknown): ScientistMarketState {
  if (!raw || typeof raw !== "object") return createInitialScientistMarket();
  const data = raw as Partial<ScientistMarketState>;
  if (!Array.isArray(data.slots)) return createInitialScientistMarket();
  return {
    slots: SCIENTIST_RESOURCES.map((expected, index) => {
      const slot = data.slots![index];
      if (slot == null) return null;
      return slot === expected ? expected : null;
    }),
  };
}

/** Liste des scientifiques possédés (uniques, ordre d’acquisition). */
export function normalizeScientistOwned(raw: unknown): ScientistResource[] {
  if (!Array.isArray(raw)) return [];
  const next: ScientistResource[] = [];
  const seen = new Set<ScientistResource>();
  for (const item of raw) {
    if (!isScientistResource(item) || seen.has(item)) continue;
    seen.add(item);
    next.push(item);
  }
  return next;
}

/**
 * Prend un scientifique du marché pour un joueur.
 * Laisse un trou à la place ; n’affecte pas les autres cases.
 */
export function takeScientistFromMarket(
  market: ScientistMarketState,
  owned: ScientistResource[],
  resource: ScientistResource,
): { market: ScientistMarketState; owned: ScientistResource[] } | null {
  const index = SCIENTIST_RESOURCES.indexOf(resource);
  if (index < 0) return null;
  if (market.slots[index] !== resource) return null;
  if (owned.includes(resource)) return null;
  const slots = [...market.slots];
  slots[index] = null;
  return {
    market: { slots },
    owned: [...owned, resource],
  };
}

export function playerOwnsScientist(
  owned: ScientistResource[],
  resource: ScientistResource,
): boolean {
  return owned.includes(resource);
}
