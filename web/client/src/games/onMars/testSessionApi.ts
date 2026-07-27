import type { ColonyResourceKind } from "./colonyResources";
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
