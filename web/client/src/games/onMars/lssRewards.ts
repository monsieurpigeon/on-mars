/** Récompenses LSS — 8 tokens identifiés 1–8. */

export type LssRewardId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const LSS_REWARD_IDS: readonly LssRewardId[] = [
  1, 2, 3, 4, 5, 6, 7, 8,
];

/** Nombre de tokens placés en haut du module LSS (case gauche libre). */
export const LSS_REWARD_TRACK_SIZE = 4;

export function isLssRewardId(n: unknown): n is LssRewardId {
  return (
    typeof n === "number" &&
    Number.isInteger(n) &&
    n >= 1 &&
    n <= 8
  );
}

/** Liste complète des 8 tokens. */
export function createLssRewardPool(): LssRewardId[] {
  return [...LSS_REWARD_IDS];
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

/** Pioche 4 tokens au hasard parmi les 8 (ordre = gauche → droite). */
export function dealLssRewardTrack(
  pool: readonly LssRewardId[] = LSS_REWARD_IDS,
): LssRewardId[] {
  return shuffleInPlace([...pool]).slice(0, LSS_REWARD_TRACK_SIZE);
}

/** Valide une piste de 4 ids uniques 1–8 ; sinon re-pioche. */
export function normalizeLssRewardTrack(raw: unknown): LssRewardId[] {
  if (!Array.isArray(raw) || raw.length !== LSS_REWARD_TRACK_SIZE) {
    return dealLssRewardTrack();
  }
  const ids: LssRewardId[] = [];
  const seen = new Set<number>();
  for (const item of raw) {
    if (!isLssRewardId(item) || seen.has(item)) {
      return dealLssRewardTrack();
    }
    seen.add(item);
    ids.push(item);
  }
  return ids;
}

export function normalizeLssRewardPool(raw: unknown): LssRewardId[] {
  if (!Array.isArray(raw) || raw.length !== LSS_REWARD_IDS.length) {
    return createLssRewardPool();
  }
  const ids: LssRewardId[] = [];
  const seen = new Set<number>();
  for (const item of raw) {
    if (!isLssRewardId(item) || seen.has(item)) {
      return createLssRewardPool();
    }
    seen.add(item);
    ids.push(item);
  }
  return ids.length === 8 ? ids : createLssRewardPool();
}
