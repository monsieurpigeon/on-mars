import type { CSSProperties } from "react";
import {
  COLONY_RESOURCE_LABELS,
  LSS_MAX,
  clampLssLevel,
  colonyResourceClass,
  type ColonyResourceKind,
} from "./colonyResources";
import { ColonyResourceToken } from "./ColonyResourceToken";
import type { LssRewardId } from "./lssRewards";
import { LSS_REWARD_TRACK_SIZE } from "./lssRewards";
import {
  LSS_TRACK_RESOURCES,
  type LssPlayerTokens,
  type LssResourceTrack,
  type LssTrackResource,
} from "./lssResourceTrack";
import { PLAYERS } from "./players";

type Props = {
  lssLevel: number;
  /** 4 tokens piochés (gauche → droite) en haut du module. */
  lssRewardRow?: LssRewardId[];
  /** Position (1–5) des tokens ressource sur la piste. */
  lssResourceTrack: LssResourceTrack;
  /** Jetons joueurs placés sous chaque ressource. */
  lssPlayerTokens?: LssPlayerTokens;
  onAdvanceResource?: (resource: LssTrackResource) => void;
};

/** Ordre des ressources LSS (gauche → droite). */
const LSS_RESOURCES: ColonyResourceKind[] = [
  "minerai",
  "energie",
  "eau",
  "plante",
  "oxygene",
];

const EMPTY_SLOTS = 5;
const LEVEL_SLOTS = 4;

/**
 * Grille LSS 5×9 (bas → haut) :
 * joueurs ×5 | ressources ×5 | niv.1–5 (tokens montent) | 1 vide | récompenses 1–8.
 */
export function ColonyLssPanel({
  lssLevel,
  lssRewardRow = [],
  lssResourceTrack,
  lssPlayerTokens,
  onAdvanceResource,
}: Props) {
  const level = clampLssLevel(lssLevel);
  const rewards = lssRewardRow.slice(0, LSS_REWARD_TRACK_SIZE);

  return (
    <div
      className="om-colony-survival-panel"
      aria-label={`Systèmes de survie — niveau ${level}`}
    >
      <div
        className="om-lss-grid"
        role="grid"
        aria-label={`Grille LSS — niveau ${level}`}
      >
        {/* Haut : case gauche libre + 4 récompenses piochées (1–8) */}
        <div
          className="om-lss-row is-rewards"
          role="row"
          aria-label="Récompenses LSS"
        >
          {Array.from({ length: EMPTY_SLOTS }, (_, i) => {
            const rewardId = i >= 1 ? rewards[i - 1] : undefined;
            return (
              <div
                key={i}
                className={`om-lss-cell ${rewardId != null ? "om-lss-reward" : "is-empty"}`}
                role="gridcell"
                aria-label={
                  rewardId != null
                    ? `Récompense LSS ${rewardId}`
                    : "Emplacement LSS"
                }
              >
                {rewardId != null && (
                  <span className="om-lss-reward-token" aria-hidden>
                    {rewardId}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Ligne vide */}
        <div className="om-lss-row" role="row">
          {Array.from({ length: EMPTY_SLOTS }, (_, i) => (
            <div
              key={i}
              className="om-lss-cell is-empty"
              role="gridcell"
              aria-label="Emplacement LSS"
            />
          ))}
        </div>

        {/* Niveaux 5 → 1 — token dans sa colonne au niveau courant */}
        {[5, 4, 3, 2, 1].map((n) => (
          <div
            key={`level-${n}`}
            className={`om-lss-row is-level ${n === level ? "is-current" : ""}`}
            role="row"
            aria-label={`Niveau ${n}${n === level ? " — actuel" : ""}`}
          >
            <div
              className={`om-lss-cell om-lss-level ${n === level ? "is-current" : ""}`}
              role="gridcell"
              aria-label={`Niveau ${n}`}
            >
              {n}
            </div>
            {Array.from({ length: LEVEL_SLOTS }, (_, i) => {
              const resource = LSS_TRACK_RESOURCES[i]!;
              const tokenLevel = lssResourceTrack[resource];
              const showToken = tokenLevel === n;
              const canAdvance = showToken && tokenLevel < LSS_MAX;
              return (
                <div
                  key={i}
                  className={`om-lss-cell ${
                    showToken ? "om-lss-reward has-resource-token" : "is-empty"
                  }`}
                  role="gridcell"
                  aria-label={
                    showToken
                      ? `${COLONY_RESOURCE_LABELS[resource]} — niveau ${n}`
                      : `Niveau ${n}, case ${i + 1}`
                  }
                >
                  {showToken && (
                    <ColonyResourceToken
                      kind={resource}
                      className="om-lss-resource-token"
                      disabled={!canAdvance}
                      onClick={
                        onAdvanceResource
                          ? () => onAdvanceResource(resource)
                          : undefined
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Ressources — 2ᵉ ligne en partant du bas */}
        <div className="om-lss-row is-resources" role="row" aria-label="Ressources">
          {LSS_RESOURCES.map((kind) => (
            <div
              key={kind}
              className={`om-lss-cell om-lss-resource ${colonyResourceClass(kind)}`}
              role="gridcell"
              title={COLONY_RESOURCE_LABELS[kind]}
              aria-label={COLONY_RESOURCE_LABELS[kind]}
            />
          ))}
        </div>

        {/* Joueurs */}
        <div
          className="om-lss-row is-players"
          role="row"
          aria-label="Couleurs joueurs"
        >
          {LSS_RESOURCES.map((kind) => {
            const placed = new Set(lssPlayerTokens?.[kind] ?? []);
            return (
              <div
                key={kind}
                className="om-lss-cell om-lss-players"
                role="gridcell"
                aria-label={`Joueurs — ${COLONY_RESOURCE_LABELS[kind]}`}
              >
                <ul className="om-lss-player-swatches" aria-hidden>
                  {PLAYERS.map((p) => (
                    <li
                      key={p.index}
                      className={`om-lss-player-swatch ${
                        placed.has(p.index) ? "is-placed" : ""
                      }`}
                      style={{ "--tick": p.color } as CSSProperties}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
