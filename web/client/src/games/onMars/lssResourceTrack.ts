import {
  LSS_MAX,
  LSS_MIN,
  type ColonyResourceKind,
} from "./colonyResources";

/** Ressources avec token sur la piste LSS (hors minerai). */
export const LSS_TRACK_RESOURCES = [
  "energie",
  "eau",
  "plante",
  "oxygene",
] as const;

export type LssTrackResource = (typeof LSS_TRACK_RESOURCES)[number];

export type LssResourceTrack = Record<LssTrackResource, number>;

export function isLssTrackResource(
  kind: ColonyResourceKind | string,
): kind is LssTrackResource {
  return (LSS_TRACK_RESOURCES as readonly string[]).includes(kind);
}

export function createInitialLssResourceTrack(): LssResourceTrack {
  return {
    energie: 1,
    eau: 1,
    plante: 1,
    oxygene: 1,
  };
}

export function clampLssResourceLevel(level: number): number {
  if (!Number.isFinite(level)) return LSS_MIN;
  return Math.min(LSS_MAX, Math.max(LSS_MIN, Math.round(level)));
}

/** Niveau LSS implicite = minimum des 4 tokens. */
export function lssLevelFromResourceTrack(track: LssResourceTrack): number {
  return Math.min(
    ...LSS_TRACK_RESOURCES.map((k) => clampLssResourceLevel(track[k])),
  );
}

export function normalizeLssResourceTrack(raw: unknown): LssResourceTrack {
  const base = createInitialLssResourceTrack();
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Partial<Record<LssTrackResource, unknown>>;
  for (const kind of LSS_TRACK_RESOURCES) {
    const n = data[kind];
    base[kind] =
      typeof n === "number" && Number.isFinite(n)
        ? clampLssResourceLevel(n)
        : 1;
  }
  return base;
}

/** Indices joueurs ayant placé un jeton sous chaque ressource LSS. */
export type LssPlayerTokens = Record<ColonyResourceKind, number[]>;

export function createInitialLssPlayerTokens(): LssPlayerTokens {
  return {
    minerai: [],
    energie: [],
    eau: [],
    plante: [],
    oxygene: [],
  };
}

export function normalizeLssPlayerTokens(raw: unknown): LssPlayerTokens {
  const base = createInitialLssPlayerTokens();
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Partial<Record<ColonyResourceKind, unknown>>;
  for (const kind of [
    "minerai",
    "energie",
    "eau",
    "plante",
    "oxygene",
  ] as const) {
    const list = data[kind];
    if (!Array.isArray(list)) continue;
    const cleaned = list
      .filter((n): n is number => typeof n === "number" && Number.isInteger(n))
      .map((n) => Math.round(n))
      .filter((n) => n >= 0 && n < 4);
    base[kind] = [...new Set(cleaned)].sort((a, b) => a - b);
  }
  return base;
}

/**
 * Monte un token d’un cran (max 5).
 * Retourne null si déjà au max.
 */
export function advanceLssResourceToken(
  track: LssResourceTrack,
  resource: LssTrackResource,
): LssResourceTrack | null {
  const current = clampLssResourceLevel(track[resource]);
  if (current >= LSS_MAX) return null;
  return { ...track, [resource]: current + 1 };
}

/** Monte les 4 tokens d’un cran (installation d’un abri). */
export function advanceAllLssResourceTokens(
  track: LssResourceTrack,
): LssResourceTrack {
  const next = { ...track };
  for (const kind of LSS_TRACK_RESOURCES) {
    next[kind] = clampLssResourceLevel(next[kind] + 1);
  }
  return next;
}
