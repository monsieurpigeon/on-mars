import {
  blueprintDisplaySlots,
  type BlueprintCardId,
  type BlueprintMarketState,
} from "./blueprints";
import {
  blueprintResourceClass,
  getBlueprintDef,
} from "./blueprintCatalog";
import { SaturnIcon } from "./SaturnIcon";

type Props = {
  open: boolean;
  blueprints: Pick<BlueprintMarketState, "rowBlue" | "rowRed">;
  onClose: () => void;
  onTake?: (cardId: BlueprintCardId) => void;
};

/**
 * Modale Plans / Blueprints — grille 2×6 (classe, titre, ressource).
 */
export function BlueprintsModal({ open, blueprints, onClose, onTake }: Props) {
  if (!open) return null;

  const slots = blueprintDisplaySlots(blueprints);

  return (
    <div
      className="om-blueprints-modal"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="om-blueprints-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="om-blueprints-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="om-blueprints-modal-head">
          <h2 id="om-blueprints-modal-title" className="om-blueprints-modal-title">
            plans - blueprints
          </h2>
          <button
            type="button"
            className="om-blueprints-modal-close"
            onClick={onClose}
            aria-label="Fermer"
          >
            Fermer
          </button>
        </div>
        <ul className="om-blueprints-grid" aria-label="Emplacements plans">
          {slots.map((cardId, index) => {
            if (cardId == null) {
              return (
                <li key={`slot-${index}`}>
                  <div
                    className="om-blueprints-slot is-empty"
                    aria-label={`Emplacement plan ${index + 1} vide`}
                  />
                </li>
              );
            }
            const def = getBlueprintDef(cardId);
            const resource = def?.resource ?? "energie";
            const level = def?.level ?? (cardId <= 12 ? 1 : 3);
            const title = def?.name ?? `Plan ${cardId}`;
            const vp = cardId <= 12 ? 3 : 5;
            return (
              <li key={`slot-${index}`}>
                <button
                  type="button"
                  className={`om-blueprints-slot is-card is-bp-class-${cardId <= 12 ? 1 : 2} ${blueprintResourceClass(resource)}`}
                  aria-label={`Classe ${level}, ${title}, ${resource}, ${vp} PV`}
                  onClick={() => onTake?.(cardId)}
                >
                  <div className="om-blueprints-slot-top">
                    <span className="om-blueprints-slot-level">{level}</span>
                    <span className="om-blueprints-slot-vp">
                      {vp}
                      <SaturnIcon size="0.85em" className="om-blueprints-slot-vp-icon" />
                    </span>
                  </div>
                  <span className="om-blueprints-slot-title">{title}</span>
                  <span className="om-blueprints-slot-resource">{resource}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
