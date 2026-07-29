/**
 * Ressources colonie (LSS) — palette canonique :
 * - oxygene  : blanc sur gris
 * - plante   : vert clair sur vert
 * - eau      : bleu clair sur bleu
 * - energie  : gris sur blanc
 * - minerai  : vert sur gris
 *
 * Ordre d’affichage : oxygène en haut → minerai en bas.
 * Toujours utiliser COLONY_RESOURCE_COLORS / les vars CSS --om-res-* .
 */

export const COLONY_RESOURCE_KINDS = [
  "oxygene",
  "plante",
  "eau",
  "energie",
  "minerai",
] as const;

export type ColonyResourceKind = (typeof COLONY_RESOURCE_KINDS)[number];

export const COLONY_RESOURCE_LABELS: Record<ColonyResourceKind, string> = {
  minerai: "Minerai",
  energie: "Énergie",
  eau: "Eau",
  plante: "Plante",
  oxygene: "Oxygène",
};

/** Encre (texte/icône) + fond — source de vérité JS. */
export const COLONY_RESOURCE_COLORS: Record<
  ColonyResourceKind,
  { ink: string; surface: string }
> = {
  minerai: { ink: "#5dff7a", surface: "#2e3236" },
  energie: { ink: "#2a2e32", surface: "#ffffff" },
  eau: { ink: "#d7f3ff", surface: "#0a4a86" },
  plante: { ink: "#e2ffcf", surface: "#145a28" },
  oxygene: { ink: "#ffffff", surface: "#3a3f44" },
};

/** Classe CSS utilitaire : définit --om-res-ink / --om-res-surface. */
export function colonyResourceClass(kind: ColonyResourceKind): string {
  return `om-res--${kind}`;
}

export type PlayerResources = Record<ColonyResourceKind, number>;

export function emptyPlayerResources(): PlayerResources {
  return {
    minerai: 0,
    energie: 0,
    eau: 0,
    plante: 0,
    oxygene: 0,
  };
}

export const LSS_MIN = 1;
export const LSS_MAX = 5;

export function clampLssLevel(level: number): number {
  if (!Number.isFinite(level)) return LSS_MIN;
  return Math.min(LSS_MAX, Math.max(LSS_MIN, Math.round(level)));
}

/** Capacité de base du stock perso (indépendante du LSS). */
export const CARRY_BASE_CAPACITY = 2;

/** Capacité de portage = base + abris installés (le LSS n’ajoute plus de slots). */
export function carryCapacity(sheltersInstalled = 0): number {
  const shelters =
    typeof sheltersInstalled === "number" && Number.isFinite(sheltersInstalled)
      ? Math.max(0, Math.round(sheltersInstalled))
      : 0;
  return CARRY_BASE_CAPACITY + shelters;
}

export type CarryChangeResult =
  | { ok: true; amount: number; capacity: number }
  | {
      ok: false;
      reason: "above_capacity" | "unchanged";
      amount: number;
      capacity: number;
    };

/**
 * Routine de gestion du portage joueur (slots ressources).
 * Seuil max = carryCapacity(sheltersInstalled) — autorité serveur.
 */
export function resolveCarrySlotInteraction(input: {
  /** Abris installés — bonus de slots (renvoyé par le serveur). */
  sheltersInstalled?: number;
  currentAmount: number;
  /** Index 0-based du slot cliqué (0 = premier jeton). */
  slotIndex: number;
}): CarryChangeResult {
  const capacity = carryCapacity(input.sheltersInstalled ?? 0);
  const current = Math.max(0, Math.round(input.currentAmount));
  const slotIndex = Math.max(0, Math.round(input.slotIndex));
  const target = slotIndex + 1;

  // Refus strict : slot hors capacité
  if (target > capacity || slotIndex >= capacity) {
    return {
      ok: false,
      reason: "above_capacity",
      amount: current,
      capacity,
    };
  }

  // Clic sur le sommet rempli → retire ; sinon remplit jusqu’au slot
  let next = current === target ? slotIndex : target;
  next = Math.max(0, next);

  if (next > capacity) {
    return {
      ok: false,
      reason: "above_capacity",
      amount: current,
      capacity,
    };
  }

  if (next === current) {
    return { ok: false, reason: "unchanged", amount: current, capacity };
  }

  // TODO(game): vérifier stock disponible, zone joueur, actions autorisées…

  return { ok: true, amount: next, capacity };
}
