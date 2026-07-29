import {
  COLONY_RESOURCE_KINDS,
  type ColonyResourceKind,
  carryCapacity,
  clampLssLevel,
  emptyPlayerResources,
  LSS_MAX,
  type PlayerResources,
} from "./colonyResources";
import {
  createInitialBlueprintMarket,
  normalizeBlueprintMarket,
  normalizeBlueprintOwned,
  syncBlueprintsForLss,
  takeBlueprintFromMarket,
  type BlueprintCardId,
  type BlueprintMarketState,
} from "./blueprints";
import {
  createInitialScientistMarket,
  normalizeScientistMarket,
  normalizeScientistOwned,
  takeScientistFromMarket,
  type ScientistMarketState,
  type ScientistResource,
} from "./scientists";
import {
  createInitialTechMarket,
  normalizeTechMarket,
  normalizeTechOwned,
  payTechRowCost,
  takeTechFromMarket,
  advanceTechRight,
  type TechKind,
  type TechMarketState,
  type TechPlacement,
  type TechTopPayResource,
} from "./techs";
import {
  createLssRewardPool,
  dealLssRewardTrack,
  normalizeLssRewardPool,
  normalizeLssRewardTrack,
  type LssRewardId,
} from "./lssRewards";
import {
  DEFAULT_SHELTER_COLONISTS,
  normalizeShelterColonists,
  normalizeSheltersInstalled,
  clampSheltersInstalled,
  SHELTER_MAX_INSTALLS,
  nextInstallableShelterRow,
  visibleShelterCapacity,
} from "./shelters";
import {
  createInitialLssPlayerTokens,
  createInitialLssResourceTrack,
  normalizeLssPlayerTokens,
  normalizeLssResourceTrack,
  lssLevelFromResourceTrack,
  type LssPlayerTokens,
  type LssResourceTrack,
} from "./lssResourceTrack";
import {
  normalizeColonyBuildings,
  startingColonyBuildings,
  type ColonyBuilding,
} from "./colonyBuildings";
import {
  normalizeColonyRovers,
  startingColonyRovers,
  syncRoverStocksWithBoard,
  type ColonyRover,
} from "./colonyRovers";
import { PLAYERS } from "./players";

export type { BlueprintCardId, BlueprintMarketState } from "./blueprints";
export {
  blueprintClass,
  createInitialBlueprintMarket,
  syncBlueprintsForLss,
  takeBlueprintFromMarket,
} from "./blueprints";
export type { ScientistMarketState, ScientistResource } from "./scientists";
export {
  SCIENTIST_RESOURCES,
  SCIENTIST_RESOURCE_LABELS,
  SCIENTIST_SLOT_COUNT,
  createInitialScientistMarket,
  scientistResourceClass,
} from "./scientists";
export type { TechKind, TechMarketState, TechPlacement, TechTopPayResource } from "./techs";
export {
  TECH_KINDS,
  TECH_KIND_LABELS,
  TECH_SLOT_COUNT,
  TECH_TOP_PAY_RESOURCES,
  createInitialTechMarket,
  leftmostAvailableTechSlots,
  canAdvanceTechRight,
  techAdvanceRightTargets,
  techKindClass,
  takeTechFromMarket,
} from "./techs";
export type { LssRewardId } from "./lssRewards";
export {
  LSS_REWARD_IDS,
  LSS_REWARD_TRACK_SIZE,
  createLssRewardPool,
  dealLssRewardTrack,
} from "./lssRewards";
export type { LssResourceTrack, LssTrackResource, LssPlayerTokens } from "./lssResourceTrack";
export {
  LSS_TRACK_RESOURCES,
  createInitialLssPlayerTokens,
  createInitialLssResourceTrack,
  advanceLssResourceToken,
  advanceAllLssResourceTokens,
  lssLevelFromResourceTrack,
  normalizeLssPlayerTokens,
} from "./lssResourceTrack";
export type { ColonyBuilding, ColonyBuildingKind } from "./colonyBuildings";
export {
  buildingFillColor,
  buildingHexId,
  buildingInkColor,
  buildingLabel,
  buildingResourceKind,
  startingColonyBuildings,
} from "./colonyBuildings";
export type { ColonyRover } from "./colonyRovers";
export {
  getColonyRover,
  roverHexId,
  setColonyRoverPosition,
  startingColonyRovers,
} from "./colonyRovers";

export const TEST_SESSION_ID = "test-solo";
export const DEFAULT_COLON_STOCK = 9;

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
  /** Plans / blueprints pris (numéros de cartes). */
  blueprints: BlueprintCardId[];
  /** Scientifiques pris (types ressource). */
  scientists: ScientistResource[];
  /** Tuiles techno placées sur la carte perso. */
  techs: TechPlacement[];
  /** Nombre de colons dans les abris (positions dérivées : bas → haut). */
  shelterColonists: number;
  /** Nombre d’abris installés (0–4) — chaque un débloque 2 cases vers le haut. */
  sheltersInstalled: number;
  /** Colons dans le stock personnel. */
  colonStock: number;
  /** Rover dans le stock personnel (0 si déjà sur le plateau). */
  roverStock: number;
  /** Colons envoyés au travail (compteur bas des abris). */
  workingColonists: number;
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
  /** Les 8 tokens récompense LSS (1–8). */
  lssRewards: LssRewardId[];
  /** 4 tokens piochés en début de partie (gauche → droite), figés. */
  lssRewardRow: LssRewardId[];
  /** Position (1–5) des 4 tokens ressource sur la piste LSS. */
  lssResourceTrack: LssResourceTrack;
  /** Indices joueurs ayant placé un jeton sous chaque ressource LSS. */
  lssPlayerTokens: LssPlayerTokens;
  missions: MissionTracker[];
  /** Missions encore ouvertes — Fin = remainingMissions / 3. */
  remainingMissions: number;
  orbitBank: OrbitBank;
  /** Marché / pioche des plans. */
  blueprints: BlueprintMarketState;
  /** Marché des scientifiques (6 cases fixes). */
  scientists: ScientistMarketState;
  /** Marché Techno — 8 tuiles piochées au hasard. */
  techMarket: TechMarketState;
  /** Bâtiments placés sur la grille hex (départ : vide). */
  colonyBuildings: ColonyBuilding[];
  /** Rovers : exactement un par joueur, position persistée. */
  colonyRovers: ColonyRover[];
};

/** Session de test — persistée sur le serveur de jeu. */
export type TestSession = {
  sessionId: typeof TEST_SESSION_ID;
  viewPlayerIndex: number;
  game: OnMarsGameState;
};

export function createInitialGameState(): OnMarsGameState {
  const lssRewards = createLssRewardPool();
  return {
    lssLevel: 1,
    lssRewards,
    lssRewardRow: dealLssRewardTrack(lssRewards),
    lssResourceTrack: createInitialLssResourceTrack(),
    lssPlayerTokens: createInitialLssPlayerTokens(),
    missions: DEFAULT_MISSIONS.map((m) => ({ ...m })),
    remainingMissions: MISSION_COUNT,
    orbitBank: fullOrbitBank(0),
    blueprints: createInitialBlueprintMarket(),
    scientists: createInitialScientistMarket(),
    techMarket: createInitialTechMarket(),
    colonyBuildings: startingColonyBuildings(),
    colonyRovers: startingColonyRovers(),
    players: PLAYERS.map((p) => ({
      playerIndex: p.index,
      zone: "orbit" as BoardZone,
      score: 0,
      resources: emptyPlayerResources(),
      crystalDepot: 0,
      blueprints: [],
      scientists: [],
      techs: [],
      shelterColonists: DEFAULT_SHELTER_COLONISTS,
      sheltersInstalled: 0,
      colonStock: DEFAULT_COLON_STOCK,
      roverStock: 0, // rovers déjà sur le plateau
      workingColonists: 0,
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
    const workingColonists =
      typeof found?.workingColonists === "number" &&
      Number.isFinite(found.workingColonists)
        ? Math.max(0, Math.round(found.workingColonists))
        : 0;
    const colonStock =
      typeof found?.colonStock === "number" && Number.isFinite(found.colonStock)
        ? Math.max(0, Math.round(found.colonStock))
        : DEFAULT_COLON_STOCK;
    const roverStock =
      typeof found?.roverStock === "number" && Number.isFinite(found.roverStock)
        ? Math.max(0, Math.min(1, Math.round(found.roverStock)))
        : 1;
    const sheltersInstalled = normalizeSheltersInstalled(
      found?.sheltersInstalled,
    );
    const shelterColonists = normalizeShelterColonists(
      found?.shelterColonists,
      sheltersInstalled,
      found && "shelterOccupied" in found ? found.shelterOccupied : undefined,
    );
    const capacity = carryCapacity(sheltersInstalled);
    return {
      playerIndex: p.index,
      zone,
      score,
      resources: normalizeResources(found?.resources, capacity),
      crystalDepot,
      blueprints: normalizeBlueprintOwned(found?.blueprints),
      scientists: normalizeScientistOwned(found?.scientists),
      techs: normalizeTechOwned(found?.techs),
      shelterColonists,
      sheltersInstalled,
      colonStock,
      roverStock,
      workingColonists,
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
  const blueprints = syncBlueprintsForLss(
    normalizeBlueprintMarket(data.game.blueprints),
    lssLevel,
  );
  const scientists = normalizeScientistMarket(data.game.scientists);
  const techMarket = normalizeTechMarket(data.game.techMarket);
  const lssRewards = normalizeLssRewardPool(data.game.lssRewards);
  const lssRewardRow = normalizeLssRewardTrack(data.game.lssRewardRow);
  const lssResourceTrack = normalizeLssResourceTrack(
    data.game.lssResourceTrack,
  );
  const lssPlayerTokens = normalizeLssPlayerTokens(data.game.lssPlayerTokens);
  const colonyBuildings = normalizeColonyBuildings(data.game.colonyBuildings);
  const colonyRovers = normalizeColonyRovers(data.game.colonyRovers);
  const syncedPlayers = syncRoverStocksWithBoard(players, colonyRovers);

  return {
    sessionId: TEST_SESSION_ID,
    viewPlayerIndex,
    game: {
      players: syncedPlayers,
      lssLevel,
      lssRewards,
      lssRewardRow,
      lssResourceTrack,
      lssPlayerTokens,
      missions,
      remainingMissions: syncRemainingMissions(missions),
      orbitBank,
      blueprints,
      scientists,
      techMarket,
      colonyBuildings,
      colonyRovers,
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
      blueprints: [],
      scientists: [],
      techs: [],
      shelterColonists: DEFAULT_SHELTER_COLONISTS,
      sheltersInstalled: 0,
      colonStock: DEFAULT_COLON_STOCK,
      roverStock: 1,
      workingColonists: 0,
    }
  );
}

/**
 * Place le rover du joueur sur le plateau depuis le stock personnel.
 */
export function deployRoverFromStock(
  state: OnMarsGameState,
  playerIndex: number,
  q: number,
  r: number,
): OnMarsGameState | null {
  const player = state.players.find((p) => p.playerIndex === playerIndex);
  if (!player || player.roverStock < 1) return null;
  if (state.colonyRovers.some((rv) => rv.playerIndex === playerIndex)) {
    return null;
  }

  const colonyRovers = normalizeColonyRovers([
    ...state.colonyRovers,
    { q: Math.round(q), r: Math.round(r), playerIndex },
  ]);
  const players = syncRoverStocksWithBoard(
    state.players.map((p) =>
      p.playerIndex === playerIndex ? { ...p, roverStock: 0 } : p,
    ),
    colonyRovers,
  );

  return { ...state, colonyRovers, players };
}

/**
 * Envoie un colon des abris vers la zone de travail (retire depuis le bas).
 */
export function sendShelterColonistToWork(
  state: OnMarsGameState,
  playerIndex: number,
): OnMarsGameState | null {
  const player = state.players.find((p) => p.playerIndex === playerIndex);
  if (!player || player.shelterColonists <= 0) return null;
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.playerIndex !== playerIndex) return p;
      return {
        ...p,
        shelterColonists: p.shelterColonists - 1,
        workingColonists: p.workingColonists + 1,
      };
    }),
  };
}

/**
 * Place un colon du stock dans les abris (empilés vers le bas).
 */
export function placeColonFromStock(
  state: OnMarsGameState,
  playerIndex: number,
): OnMarsGameState | null {
  const player = state.players.find((p) => p.playerIndex === playerIndex);
  if (!player || player.colonStock <= 0) return null;
  const cap = visibleShelterCapacity(player.sheltersInstalled);
  if (player.shelterColonists >= cap) return null;
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.playerIndex !== playerIndex) return p;
      return {
        ...p,
        colonStock: p.colonStock - 1,
        shelterColonists: p.shelterColonists + 1,
      };
    }),
  };
}

/**
 * Installe le prochain abri (rangée couverte la plus basse).
 * Débloque 2 cases meeples et +1 capacité de portage. Ne touche pas aux tokens LSS.
 */
export function installNextShelter(
  state: OnMarsGameState,
  playerIndex: number,
): OnMarsGameState | null {
  const player = state.players.find((p) => p.playerIndex === playerIndex);
  if (!player) return null;
  const installed = clampSheltersInstalled(player.sheltersInstalled);
  if (installed >= SHELTER_MAX_INSTALLS) return null;
  if (nextInstallableShelterRow(installed) == null) return null;

  const sheltersInstalled = installed + 1;
  const shelterColonists = normalizeShelterColonists(
    player.shelterColonists,
    sheltersInstalled,
  );

  return {
    ...state,
    players: state.players.map((p) => {
      if (p.playerIndex !== playerIndex) return p;
      return {
        ...p,
        sheltersInstalled,
        shelterColonists,
      };
    }),
  };
}

/** Monte le LSS tant que tous les tokens ressources ont atteint le palier suivant. */
export function syncLssLevelFromResourceTrack(
  state: OnMarsGameState,
): OnMarsGameState {
  let next = state;
  const min = lssLevelFromResourceTrack(next.lssResourceTrack);
  while (next.lssLevel < LSS_MAX && min > next.lssLevel) {
    const leveled = setLssLevel(next, next.lssLevel + 1);
    next = {
      ...leveled,
      orbitBank: fullOrbitBank(leveled.orbitBank.generation + 1),
    };
  }
  return next;
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
  return {
    ...state,
    lssLevel,
    blueprints: syncBlueprintsForLss(state.blueprints, lssLevel),
    players: state.players.map((p) => ({
      ...p,
      resources: normalizeResources(
        p.resources,
        carryCapacity(p.sheltersInstalled),
      ),
    })),
  };
}

/** Prend une carte plan du marché pour un joueur. */
export function takePlayerBlueprint(
  state: OnMarsGameState,
  playerIndex: number,
  cardId: BlueprintCardId,
): OnMarsGameState | null {
  const player = state.players.find((p) => p.playerIndex === playerIndex);
  if (!player) return null;
  const taken = takeBlueprintFromMarket(
    state.blueprints,
    cardId,
    player.blueprints,
  );
  if (!taken) return null;
  return {
    ...state,
    blueprints: taken.market,
    players: state.players.map((p) =>
      p.playerIndex === playerIndex
        ? { ...p, blueprints: taken.owned }
        : p,
    ),
  };
}

/** Prend un scientifique du marché pour un joueur. */
export function takePlayerScientist(
  state: OnMarsGameState,
  playerIndex: number,
  resource: ScientistResource,
): OnMarsGameState | null {
  const player = state.players.find((p) => p.playerIndex === playerIndex);
  if (!player) return null;
  const taken = takeScientistFromMarket(
    state.scientists,
    player.scientists,
    resource,
  );
  if (!taken) return null;
  return {
    ...state,
    scientists: taken.market,
    players: state.players.map((p) =>
      p.playerIndex === playerIndex
        ? { ...p, scientists: taken.owned }
        : p,
    ),
  };
}

/** Prend une tuile techno du marché et la place sur la carte perso. */
export function takePlayerTech(
  state: OnMarsGameState,
  playerIndex: number,
  kind: TechKind,
  q: number,
  r: number,
  payExtra?: TechTopPayResource | null,
): OnMarsGameState | null {
  const player = state.players.find((p) => p.playerIndex === playerIndex);
  if (!player) return null;
  const taken = takeTechFromMarket(state.techMarket, player.techs, kind, q, r);
  if (!taken) return null;
  const paid = payTechRowCost(player.resources, taken.row, payExtra);
  if (!paid) return null;
  return {
    ...state,
    techMarket: taken.market,
    players: state.players.map((p) =>
      p.playerIndex === playerIndex
        ? { ...p, techs: taken.owned, resources: paid }
        : p,
    ),
  };
}

/** Fait évoluer une techno vers une case voisine à droite (haut ou bas). */
export function advancePlayerTech(
  state: OnMarsGameState,
  playerIndex: number,
  kind: TechKind,
  q: number,
  r: number,
): OnMarsGameState | null {
  const player = state.players.find((p) => p.playerIndex === playerIndex);
  if (!player) return null;
  const next = advanceTechRight(player.techs, kind, q, r);
  if (!next) return null;
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerIndex === playerIndex ? { ...p, techs: next } : p,
    ),
  };
}

/** Réordonne les blueprints d’un joueur (drag & drop). */
export function reorderPlayerBlueprints(
  state: OnMarsGameState,
  playerIndex: number,
  fromIndex: number,
  toIndex: number,
): OnMarsGameState {
  if (fromIndex === toIndex) return state;
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.playerIndex !== playerIndex) return p;
      const next = [...p.blueprints];
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= next.length ||
        toIndex >= next.length
      ) {
        return p;
      }
      const [item] = next.splice(fromIndex, 1);
      if (item == null) return p;
      next.splice(toIndex, 0, item);
      return { ...p, blueprints: next };
    }),
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
  const player = state.players.find((p) => p.playerIndex === playerIndex);
  const capacity = carryCapacity(player?.sheltersInstalled ?? 0);
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
