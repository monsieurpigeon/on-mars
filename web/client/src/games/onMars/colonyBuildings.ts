/** Bâtiments placés sur la grille hexagonale de la colonie. */

import { COLONY_RESOURCE_COLORS, type ColonyResourceKind } from "./colonyResources";
import { PLAYERS } from "./players";

export const COLONY_BUILDING_KINDS = [
  "mine",
  "generator",
  "water_extractor",
  "greenhouse",
  "oxygen_condenser",
  "shelter",
] as const;

export type ColonyBuildingKind = (typeof COLONY_BUILDING_KINDS)[number];

export type ColonyBuilding = {
  q: number;
  r: number;
  kind: ColonyBuildingKind;
  /** Requis pour `shelter` — index joueur (0–3). */
  playerIndex?: number;
};

export const COLONY_BUILDING_LABELS: Record<ColonyBuildingKind, string> = {
  mine: "Mine",
  generator: "Générateur",
  water_extractor: "Extracteur d'eau",
  greenhouse: "Serre",
  oxygen_condenser: "Condensateur d'oxygène",
  shelter: "Abri",
};

export function buildingHexId(b: Pick<ColonyBuilding, "q" | "r">): string {
  return `${b.q},${b.r}`;
}

/**
 * Couleur de remplissage de l’hex bâtiment.
 * Ressources = palette colonie ; abris = couleur joueur
 * (aqua → teal plus soutenu, distinct de l’eau et du cyan UI).
 */
export function buildingFillColor(b: ColonyBuilding): string {
  switch (b.kind) {
    case "mine":
      return COLONY_RESOURCE_COLORS.minerai.surface;
    case "generator":
      return COLONY_RESOURCE_COLORS.energie.surface;
    case "water_extractor":
      return COLONY_RESOURCE_COLORS.eau.surface;
    case "greenhouse":
      return COLONY_RESOURCE_COLORS.plante.surface;
    case "oxygen_condenser":
      return COLONY_RESOURCE_COLORS.oxygene.surface;
    case "shelter": {
      const idx = b.playerIndex ?? 0;
      const player = PLAYERS[Math.min(Math.max(idx, 0), PLAYERS.length - 1)]!;
      if (player.colorKey === "aqua") return "#0B7C78";
      return player.color;
    }
  }
}

/** Encre du logo (comme les tokens LSS). */
export function buildingInkColor(b: ColonyBuilding): string {
  switch (b.kind) {
    case "mine":
      return COLONY_RESOURCE_COLORS.minerai.ink;
    case "generator":
      return COLONY_RESOURCE_COLORS.energie.ink;
    case "water_extractor":
      return COLONY_RESOURCE_COLORS.eau.ink;
    case "greenhouse":
      return COLONY_RESOURCE_COLORS.plante.ink;
    case "oxygen_condenser":
      return COLONY_RESOURCE_COLORS.oxygene.ink;
    case "shelter": {
      const idx = b.playerIndex ?? 0;
      const player = PLAYERS[Math.min(Math.max(idx, 0), PLAYERS.length - 1)]!;
      if (player.colorKey === "aqua") return "#E6FFFE";
      return player.ink;
    }
  }
}

/** Ressource affichée en logo (null pour abri → icône bâtiment). */
export function buildingResourceKind(
  b: ColonyBuilding,
): ColonyResourceKind | null {
  switch (b.kind) {
    case "mine":
      return "minerai";
    case "generator":
      return "energie";
    case "water_extractor":
      return "eau";
    case "greenhouse":
      return "plante";
    case "oxygen_condenser":
      return "oxygene";
    case "shelter":
      return null;
  }
}

export function buildingLabel(b: ColonyBuilding): string {
  if (b.kind === "shelter") {
    const idx = b.playerIndex ?? 0;
    const player = PLAYERS[Math.min(Math.max(idx, 0), PLAYERS.length - 1)]!;
    return `Abri ${player.name}`;
  }
  return COLONY_BUILDING_LABELS[b.kind];
}

export function buildingComplexKey(
  b: Pick<ColonyBuilding, "kind" | "playerIndex">,
): string {
  if (b.kind === "shelter") return `shelter:${b.playerIndex ?? 0}`;
  return b.kind;
}

/** Carte de départ : aucun bâtiment (placement via le jeu). */
export function startingColonyBuildings(): ColonyBuilding[] {
  return [];
}

function isBuildingKind(value: unknown): value is ColonyBuildingKind {
  return (
    typeof value === "string" &&
    (COLONY_BUILDING_KINDS as readonly string[]).includes(value)
  );
}

export function normalizeColonyBuildings(raw: unknown): ColonyBuilding[] {
  if (!Array.isArray(raw)) return startingColonyBuildings();

  const byHex = new Map<string, ColonyBuilding>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const data = item as Partial<ColonyBuilding>;
    if (
      typeof data.q !== "number" ||
      !Number.isFinite(data.q) ||
      typeof data.r !== "number" ||
      !Number.isFinite(data.r) ||
      !isBuildingKind(data.kind)
    ) {
      continue;
    }
    const building: ColonyBuilding = {
      q: Math.round(data.q),
      r: Math.round(data.r),
      kind: data.kind,
    };
    if (data.kind === "shelter") {
      const pi =
        typeof data.playerIndex === "number" && Number.isFinite(data.playerIndex)
          ? Math.max(0, Math.min(PLAYERS.length - 1, Math.round(data.playerIndex)))
          : 0;
      building.playerIndex = pi;
    }
    byHex.set(buildingHexId(building), building);
  }

  const list = [...byHex.values()];
  // Migre l’ancienne carte démo dense → vide.
  if (list.length >= 20) return [];
  return list;
}
