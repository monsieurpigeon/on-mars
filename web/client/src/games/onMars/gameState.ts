import {
  COLONY_RESOURCE_KINDS,
  type ColonyResourceKind,
  carryCapacity,
  clampLssLevel,
  emptyPlayerResources,
  type PlayerResources,
} from "./colonyResources";
import { PLAYERS } from "./players";

export const TEST_SESSION_ID = "test-solo";

/** Zone physique du joueur sur le plateau. */
export type BoardZone = "orbit" | "colony";

export const BOARD_ZONE_LABELS: Record<BoardZone, string> = {
  orbit: "Orbite",
  colony: "Colonie",
};

export type PlayerGameState = {
  playerIndex: number;
  zone: BoardZone;
  score: number;
  /** Ressources portées (par type), bornées à lssLevel + 1. */
  resources: PlayerResources;
  /** Dépôt de cristaux violet. */
  crystalDepot: number;
};

export type MissionId = "a" | "b" | "c";

export type MissionTracker = {
  id: MissionId;
  label: string;
  /** Progression restante (descend vers 0). */
  tracker: number;
  goal: number;
};

export const MISSION_COUNT = 3;
export const DEFAULT_MISSION_TRACKER = 10;
export const DEFAULT_MISSION_GOAL = 14;

export const DEFAULT_MISSIONS: MissionTracker[] = [
  {
    id: "a",
    label: "Mission A",
    tracker: DEFAULT_MISSION_TRACKER,
    goal: DEFAULT_MISSION_GOAL,
  },
  {
    id: "b",
    label: "Mission B",
    tracker: DEFAULT_MISSION_TRACKER,
    goal: DEFAULT_MISSION_GOAL,
  },
  {
    id: "c",
    label: "Mission C",
    tracker: DEFAULT_MISSION_TRACKER,
    goal: DEFAULT_MISSION_GOAL,
  },
];

/** Colonnes de la banque orbite (ordre d’affichage). */
export const ORBIT_BANK_KINDS = [
  "cristal",
  "energie",
  "eau",
  "plante",
  "oxygene",
] as const;

export type OrbitBankKind = (typeof ORBIT_BANK_KINDS)[number];

export const ORBIT_BANK_STACK = 3;
export const CRYSTAL_DEPOT_CAPACITY = 8;

export const ORBIT_BANK_LABELS: Record<OrbitBankKind, string> = {
  cristal: "Cristal",
  energie: "Énergie",
  eau: "Eau",
  plante: "Plante",
  oxygene: "Oxygène",
};

export type OrbitBank = Record<OrbitBankKind, number> & {
  generation: number;
};

export function emptyOrbitBank(generation = 0): OrbitBank {
  return {
    cristal: 0,
    energie: 0,
    eau: 0,
    plante: 0,
    oxygene: 0,
    generation,
  };
}

export function fullOrbitBank(generation = 0): OrbitBank {
  return {
    cristal: ORBIT_BANK_STACK,
    energie: ORBIT_BANK_STACK,
    eau: ORBIT_BANK_STACK,
    plante: ORBIT_BANK_STACK,
    oxygene: ORBIT_BANK_STACK,
    generation,
  };
}

export type OnMarsGameState = {
  players: PlayerGameState[];
  /** Niveau LSS / systèmes de survie (1–5). */
  lssLevel: number;
  missions: MissionTracker[];
  /** Missions encore ouvertes — Fin = remainingMissions / 3. */
  remainingMissions: number;
  orbitBank: OrbitBank;
};

/** Session de test — persistée sur le serveur de jeu. */
export type TestSession = {
  sessionId: typeof TEST_SESSION_ID;
  viewPlayerIndex: number;
  game: OnMarsGameState;
};

export function createInitialGameState(): OnMarsGameState {
  return {
    lssLevel: 1,
    missions: DEFAULT_MISSIONS.map((m) => ({ ...m })),
    remainingMissions: MISSION_COUNT,
    orbitBank: fullOrbitBank(0),
    players: PLAYERS.map((p) => ({
      playerIndex: p.index,
      zone: "orbit" as BoardZone,
      score: 0,
      resources: emptyPlayerResources(),
      crystalDepot: 0,
    })),
  };
}

function syncRemainingMissions(missions: MissionTracker[]): number {
  const completed = missions.filter((m) => m.tracker === 0).length;
  return Math.max(0, MISSION_COUNT - Math.min(MISSION_COUNT, completed));
}

function normalizeMissions(raw: unknown): MissionTracker[] {
  const byId = new Map<string, Partial<MissionTracker>>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const m = item as Partial<MissionTracker>;
      if (typeof m.id === "string") byId.set(m.id, m);
    }
  }
  return DEFAULT_MISSIONS.map((def) => {
    const found = byId.get(def.id);
    const goal =
      typeof found?.goal === "number" && Number.isFinite(found.goal) && found.goal > 0
        ? Math.round(found.goal)
        : def.goal;
    const trackerRaw =
      typeof found?.tracker === "number" && Number.isFinite(found.tracker)
        ? Math.round(found.tracker)
        : def.tracker;
    return {
      id: def.id,
      label: def.label,
      goal,
      tracker: Math.min(goal, Math.max(0, trackerRaw)),
    };
  });
}

export function createInitialTestSession(): TestSession {
  return {
    sessionId: TEST_SESSION_ID,
    viewPlayerIndex: 0,
    game: createInitialGameState(),
  };
}

function normalizeResources(
  raw: unknown,
  capacity: number,
): PlayerResources {
  const base = emptyPlayerResources();
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Partial<Record<ColonyResourceKind, unknown>>;
  for (const kind of COLONY_RESOURCE_KINDS) {
    const n = data[kind];
    base[kind] =
      typeof n === "number" && Number.isFinite(n)
        ? Math.min(capacity, Math.max(0, Math.round(n)))
        : 0;
  }
  return base;
}

function normalizeOrbitBank(raw: unknown): OrbitBank {
  const base = fullOrbitBank(0);
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Partial<Record<OrbitBankKind | "generation", unknown>>;
  for (const kind of ORBIT_BANK_KINDS) {
    const n = data[kind];
    base[kind] =
      typeof n === "number" && Number.isFinite(n)
        ? Math.min(ORBIT_BANK_STACK, Math.max(0, Math.round(n)))
        : ORBIT_BANK_STACK;
  }
  base.generation =
    typeof data.generation === "number" && Number.isFinite(data.generation)
      ? Math.max(0, Math.round(data.generation))
      : 0;
  return base;
}

export function normalizeSession(raw: unknown): TestSession {
  if (!raw || typeof raw !== "object") return createInitialTestSession();
  const data = raw as Partial<TestSession>;
  if (!data.game || !Array.isArray(data.game.players)) {
    return createInitialTestSession();
  }

  const lssLevel = clampLssLevel(
    typeof data.game.lssLevel === "number" ? data.game.lssLevel : 1,
  );
  const capacity = carryCapacity(lssLevel);

  const players = PLAYERS.map((p) => {
    const found = data.game!.players.find((x) => x?.playerIndex === p.index);
    const zone: BoardZone = found?.zone === "colony" ? "colony" : "orbit";
    const score =
      typeof found?.score === "number" && Number.isFinite(found.score)
        ? found.score
        : 0;
    const crystalDepot =
      typeof found?.crystalDepot === "number" && Number.isFinite(found.crystalDepot)
        ? Math.min(CRYSTAL_DEPOT_CAPACITY, Math.max(0, Math.round(found.crystalDepot)))
        : 0;
    return {
      playerIndex: p.index,
      zone,
      score,
      resources: normalizeResources(found?.resources, capacity),
      crystalDepot,
    };
  });

  const viewPlayerIndex =
    typeof data.viewPlayerIndex === "number" &&
    data.viewPlayerIndex >= 0 &&
    data.viewPlayerIndex < PLAYERS.length
      ? data.viewPlayerIndex
      : 0;

  const missions = normalizeMissions(data.game.missions);
  const orbitBank = normalizeOrbitBank(data.game.orbitBank);

  return {
    sessionId: TEST_SESSION_ID,
    viewPlayerIndex,
    game: {
      players,
      lssLevel,
      missions,
      remainingMissions: syncRemainingMissions(missions),
      orbitBank,
    },
  };
}

export function getPlayerState(
  state: OnMarsGameState,
  playerIndex: number,
): PlayerGameState {
  return (
    state.players.find((p) => p.playerIndex === playerIndex) ?? {
      playerIndex,
      zone: "orbit",
      score: 0,
      resources: emptyPlayerResources(),
      crystalDepot: 0,
    }
  );
}

export function togglePlayerZone(
  state: OnMarsGameState,
  playerIndex: number,
): OnMarsGameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerIndex === playerIndex
        ? { ...p, zone: p.zone === "orbit" ? "colony" : "orbit" }
        : p,
    ),
  };
}

/** Met à jour le LSS et borne les inventaires. */
export function setLssLevel(state: OnMarsGameState, level: number): OnMarsGameState {
  const lssLevel = clampLssLevel(level);
  const capacity = carryCapacity(lssLevel);
  return {
    ...state,
    lssLevel,
    players: state.players.map((p) => ({
      ...p,
      resources: normalizeResources(p.resources, capacity),
    })),
  };
}

/** Met à jour le compteur d’une mission et synchronise Fin. */
export function setMissionTracker(
  state: OnMarsGameState,
  missionId: MissionId,
  tracker: number,
): OnMarsGameState {
  const missions = state.missions.map((m) => {
    if (m.id !== missionId) return m;
    const next = Math.min(m.goal, Math.max(0, Math.round(tracker)));
    return { ...m, tracker: next };
  });
  return {
    ...state,
    missions,
    remainingMissions: syncRemainingMissions(missions),
  };
}

/** Met à jour une ressource portée (bornée à la capacité). */
export function setPlayerResourceAmount(
  state: OnMarsGameState,
  playerIndex: number,
  kind: ColonyResourceKind,
  amount: number,
): OnMarsGameState {
  const capacity = carryCapacity(state.lssLevel);
  const next = Math.min(capacity, Math.max(0, Math.round(amount)));
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerIndex === playerIndex
        ? { ...p, resources: { ...p.resources, [kind]: next } }
        : p,
    ),
  };
}

export function getMission(
  state: OnMarsGameState,
  missionId: MissionId,
): MissionTracker {
  return (
    state.missions.find((m) => m.id === missionId) ??
    DEFAULT_MISSIONS.find((m) => m.id === missionId)!
  );
}
