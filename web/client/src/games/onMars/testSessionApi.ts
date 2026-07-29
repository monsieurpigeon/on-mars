import type { ColonyResourceKind } from "./colonyResources";
import type { ScientistResource } from "./scientists";
import type { TechKind, TechTopPayResource } from "./techs";
import {
  createInitialTestSession,
  normalizeSession,
  type MissionId,
  type OrbitBankKind,
  type TestSession,
} from "./gameState";

const BASE = "/api/test-session";

async function parseSession(res: Response): Promise<TestSession> {
  if (!res.ok) {
    throw new Error(`test-session HTTP ${res.status}`);
  }
  return normalizeSession(await res.json());
}

export async function fetchTestSession(): Promise<TestSession> {
  try {
    const res = await fetch(BASE);
    return await parseSession(res);
  } catch (err) {
    console.error("fetchTestSession failed", err);
    return createInitialTestSession();
  }
}

export async function putTestSession(session: TestSession): Promise<TestSession> {
  const res = await fetch(BASE, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(normalizeSession(session)),
  });
  return parseSession(res);
}

export async function resetTestSessionOnServer(): Promise<TestSession> {
  const res = await fetch(`${BASE}/reset`, { method: "POST" });
  return parseSession(res);
}

/** Met à jour le niveau LSS côté serveur (borne les inventaires). */
export async function updateLssLevelOnServer(lssLevel: number): Promise<TestSession> {
  const res = await fetch(`${BASE}/lss`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lssLevel }),
  });
  return parseSession(res);
}

/** +1 LSS + recharge banque orbite (anim generation côté clients). */
export async function levelUpLssOnServer(): Promise<TestSession> {
  const res = await fetch(`${BASE}/lss/level-up`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`lss level-up HTTP ${res.status}`);
  }
  return parseSession(res);
}

/** Monte un token ressource LSS d’un niveau (+ level-up auto si tous au palier suivant). */
export async function advanceLssResourceOnServer(
  resource: "energie" | "eau" | "plante" | "oxygene",
): Promise<TestSession> {
  const res = await fetch(`${BASE}/lss/advance-resource`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resource }),
  });
  if (!res.ok) {
    throw new Error(`lss advance-resource HTTP ${res.status}`);
  }
  return parseSession(res);
}

/** Place le jeton d’un joueur sous une ressource LSS. */
export async function placeLssPlayerTokenOnServer(
  playerIndex: number,
  resource: ColonyResourceKind,
): Promise<TestSession> {
  const res = await fetch(`${BASE}/lss/place-player-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerIndex, resource }),
  });
  if (!res.ok) {
    throw new Error(`lss place-player-token HTTP ${res.status}`);
  }
  return parseSession(res);
}

/** Installe le prochain abri : +2 cases meeples, +1 capacité perso (tokens LSS inchangés). */
export async function installShelterOnServer(
  playerIndex: number,
): Promise<TestSession> {
  const res = await fetch(`${BASE}/shelters/install`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerIndex }),
  });
  if (!res.ok) {
    throw new Error(`shelters install HTTP ${res.status}`);
  }
  return parseSession(res);
}

/** Place un colon du stock dans la prochaine case abri libre (bas → gauche). */
export async function placeColonOnServer(
  playerIndex: number,
): Promise<TestSession> {
  const res = await fetch(`${BASE}/shelters/place-colon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerIndex }),
  });
  if (!res.ok) {
    throw new Error(`shelters place-colon HTTP ${res.status}`);
  }
  return parseSession(res);
}

/** Envoie un colon des abris vers la zone de travail (retire depuis le bas). */
export async function sendColonToWorkOnServer(
  playerIndex: number,
): Promise<TestSession> {
  const res = await fetch(`${BASE}/shelters/send-to-work`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerIndex }),
  });
  if (!res.ok) {
    throw new Error(`shelters send-to-work HTTP ${res.status}`);
  }
  return parseSession(res);
}

/** Rapatrie les colons au travail : remplit les abris, surplus → stock. */
export async function recallWorkersOnServer(
  playerIndex: number,
): Promise<TestSession> {
  const res = await fetch(`${BASE}/shelters/recall-workers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerIndex }),
  });
  if (!res.ok) {
    throw new Error(`shelters recall-workers HTTP ${res.status}`);
  }
  return parseSession(res);
}

/** Met à jour une ressource portée par un joueur côté serveur. */
export async function updatePlayerResourceOnServer(
  playerIndex: number,
  kind: ColonyResourceKind,
  amount: number,
): Promise<TestSession> {
  const res = await fetch(`${BASE}/resources`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerIndex, kind, amount }),
  });
  return parseSession(res);
}

/** Met à jour le compteur d’une mission côté serveur (sync Fin). */
export async function updateMissionTrackerOnServer(
  missionId: MissionId,
  tracker: number,
): Promise<TestSession> {
  const res = await fetch(`${BASE}/missions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ missionId, tracker }),
  });
  return parseSession(res);
}

/** Prend 1 ressource dans la banque orbite pour un joueur. */
export async function takeOrbitBankOnServer(
  playerIndex: number,
  kind: OrbitBankKind,
): Promise<TestSession> {
  const res = await fetch(`${BASE}/orbit-bank/take`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerIndex, kind }),
  });
  if (!res.ok) {
    throw new Error(`orbit-bank take HTTP ${res.status}`);
  }
  return parseSession(res);
}

/** Recharge la banque orbite (bump generation → anim clients). */
export async function reloadOrbitBankOnServer(): Promise<TestSession> {
  const res = await fetch(`${BASE}/orbit-bank/reload`, { method: "POST" });
  return parseSession(res);
}

/** Déplace le rover d’un joueur sur une case adjacente. */
export async function moveRoverOnServer(
  playerIndex: number,
  q: number,
  r: number,
): Promise<TestSession> {
  const res = await fetch(`${BASE}/rovers/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerIndex, q, r }),
  });
  if (!res.ok) {
    throw new Error(`rovers move HTTP ${res.status}`);
  }
  return parseSession(res);
}

/** Prend une carte plan du marché pour un joueur. */
export async function takeBlueprintOnServer(
  playerIndex: number,
  cardId: number,
): Promise<TestSession> {
  const res = await fetch(`${BASE}/blueprints/take`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerIndex, cardId }),
  });
  if (!res.ok) {
    throw new Error(`blueprint take HTTP ${res.status}`);
  }
  return parseSession(res);
}

/** Prend un scientifique du marché pour un joueur. */
export async function takeScientistOnServer(
  playerIndex: number,
  resource: ScientistResource,
): Promise<TestSession> {
  const res = await fetch(`${BASE}/scientists/take`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerIndex, resource }),
  });
  if (!res.ok) {
    throw new Error(`scientist take HTTP ${res.status}`);
  }
  return parseSession(res);
}

/** Prend une tuile techno et la place sur la carte perso. */
export async function takeTechOnServer(
  playerIndex: number,
  kind: TechKind,
  q: number,
  r: number,
  payResource?: TechTopPayResource | null,
): Promise<TestSession> {
  const res = await fetch(`${BASE}/techs/take`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      playerIndex,
      kind,
      q,
      r,
      ...(payResource ? { payResource } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`tech take HTTP ${res.status}`);
  }
  return parseSession(res);
}

/** Fait évoluer une techno d’un hex vers la droite. */
export async function advanceTechOnServer(
  playerIndex: number,
  kind: TechKind,
  q: number,
  r: number,
): Promise<TestSession> {
  const res = await fetch(`${BASE}/techs/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerIndex, kind, q, r }),
  });
  if (!res.ok) {
    throw new Error(`tech advance HTTP ${res.status}`);
  }
  return parseSession(res);
}
