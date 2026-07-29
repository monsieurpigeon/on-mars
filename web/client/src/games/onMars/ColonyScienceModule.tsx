import type { CSSProperties } from "react";
import { ActionRoundButton } from "./ActionRoundButton";
import { PLAYERS } from "./players";
import { ResourceIcon } from "./ResourceIcon";
import {
  SCIENTIST_RESOURCES,
  SCIENTIST_RESOURCE_LABELS,
  SCIENTIST_SLOT_COUNT,
  scientistResourceClass,
  type ScientistMarketState,
  type ScientistResource,
} from "./scientists";

type Props = {
  label?: string;
  description?: string;
  market: ScientistMarketState;
  selected?: boolean;
  onClick?: () => void;
  onTakeScientist?: (resource: ScientistResource) => void;
};

/**
 * Module Science — 6 meeples en ligne au-dessus, couleurs joueurs 2×2 en dessous.
 */
export function ColonyScienceModule({
  label = "Science",
  description = "Engager un scientifique",
  market,
  selected = false,
  onClick,
  onTakeScientist,
}: Props) {
  const available = market.slots.filter((s) => s != null).length;

  return (
    <div
      className={`om-colony-science ${selected ? "is-selected" : ""}`}
      aria-label={description}
    >
      <div className="om-action-head">
        <span className="om-colony-science-label">{label}</span>
        <ActionRoundButton
          label={description}
          tone="colony"
          selected={selected}
          onClick={onClick}
        />
      </div>
      <div className="om-colony-science-body">
        <ul
          className="om-colony-science-meeples"
          aria-label={`Scientifiques ${available} sur ${SCIENTIST_SLOT_COUNT}`}
        >
          {SCIENTIST_RESOURCES.map((resource, index) => {
            const isFilled = market.slots[index] === resource;
            const resLabel = SCIENTIST_RESOURCE_LABELS[resource];
            return (
              <li key={resource} className="om-colony-science-meeple-wrap">
                <button
                  type="button"
                  className={`om-colony-science-meeple ${scientistResourceClass(resource)} ${isFilled ? "is-filled" : ""}`}
                  title={
                    isFilled
                      ? `Prendre scientifique ${resLabel}`
                      : `Emplacement ${resLabel} — vide`
                  }
                  aria-label={
                    isFilled
                      ? `Prendre scientifique ${resLabel}`
                      : `Emplacement ${resLabel}`
                  }
                  disabled={!isFilled}
                  onClick={() => onTakeScientist?.(resource)}
                >
                  {isFilled && (
                    <ResourceIcon
                      kind="colon"
                      showTooltip={false}
                      className="om-colony-science-meeple-icon"
                      title={resLabel}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <ul className="om-colony-science-colors" aria-label="Joueurs">
          {PLAYERS.map((p) => (
            <li
              key={p.index}
              className="om-colony-science-color"
              style={{ "--tick": p.color } as CSSProperties}
              title={p.name}
              aria-label={p.name}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
