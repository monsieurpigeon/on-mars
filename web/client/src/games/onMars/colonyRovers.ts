/** Rovers sur la grille — au plus un par joueur, position persistée tant qu’il est sur le plateau. */

import { PLAYERS } from "./players";

export type ColonyRover = {
  q: number;
  r: number;
  /** Propriétaire (0–3). */
  playerIndex: number;
};

/** Positions de départ si le rover est déployé dès le début. */
const START_COORDS: readonly { q: number; r: number }[] = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
];

export const DEFAULT_ROVER_STOCK = 1;

export function roverHexId(r: Pick<ColonyRover, "q" | "r">): string {
  return `${r.q},${r.r}`;
}

/**
 * Départ : tous les rovers déjà sur le plateau (stock perso = 0 après sync).
 */
export function startingColonyRovers(): ColonyRover[] {
  return PLAYERS.map((p) => {
    const coord = START_COORDS[p.index] ?? { q: 0, r: 0 };
    return { q: coord.q, r: coord.r, playerIndex: p.index };
  });
}

export function getColonyRover(
  rovers: readonly ColonyRover[],
  playerIndex: number,
): ColonyRover | undefined {
  return rovers.find((r) => r.playerIndex === playerIndex);
}

/** Met à jour la position d’un rover déjà sur le plateau. */
export function setColonyRoverPosition(
  rovers: readonly ColonyRover[],
  playerIndex: number,
  q: number,
  r: number,
): ColonyRover[] {
  return normalizeColonyRovers(rovers).map((rover) =>
    rover.playerIndex === playerIndex
      ? { ...rover, q: Math.round(q), r: Math.round(r) }
      : rover,
  );
}

/**
 * Garde au plus un rover par joueur (ceux présents sur le plateau).
 * Ne recrée pas les absents — ils restent en stock perso.
 */
export function normalizeColonyRovers(raw: unknown): ColonyRover[] {
  if (!Array.isArray(raw)) return startingColonyRovers();

  const byPlayer = new Map<number, ColonyRover>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const data = item as Partial<ColonyRover>;
    if (
      typeof data.playerIndex !== "number" ||
      !Number.isFinite(data.playerIndex) ||
      typeof data.q !== "number" ||
      !Number.isFinite(data.q) ||
      typeof data.r !== "number" ||
      !Number.isFinite(data.r)
    ) {
      continue;
    }
    const playerIndex = Math.max(
      0,
      Math.min(PLAYERS.length - 1, Math.round(data.playerIndex)),
    );
    byPlayer.set(playerIndex, {
      playerIndex,
      q: Math.round(data.q),
      r: Math.round(data.r),
    });
  }

  return [...byPlayer.values()].sort((a, b) => a.playerIndex - b.playerIndex);
}

/** Rover sur le plateau → stock 0 ; sinon stock 1. */
export function syncRoverStocksWithBoard<
  T extends { playerIndex: number; roverStock: number },
>(players: readonly T[], rovers: readonly ColonyRover[]): T[] {
  const onBoard = new Set(rovers.map((r) => r.playerIndex));
  return players.map((player) => ({
    ...player,
    roverStock: onBoard.has(player.playerIndex) ? 0 : DEFAULT_ROVER_STOCK,
  }));
}
