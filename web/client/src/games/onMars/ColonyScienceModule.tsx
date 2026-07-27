import type { CSSProperties } from "react";
import { ActionRoundButton } from "./ActionRoundButton";
import { PLAYERS } from "./players";
import { ResourceIcon } from "./ResourceIcon";

type Props = {
  label?: string;
  description?: string;
  /** Nombre de meeples affichés (max 6). */
  meepleCount?: number;
  selected?: boolean;
  onClick?: () => void;
};

const MEEPLE_SLOTS = 6;

/**
 * Module Science — 6 meeples en ligne au-dessus, couleurs joueurs 2×2 en dessous.
 */
export function ColonyScienceModule({
  label = "Science",
  description = "Engager un scientifique",
  meepleCount = MEEPLE_SLOTS,
  selected = false,
  onClick,
}: Props) {
  const filled = Math.min(MEEPLE_SLOTS, Math.max(0, Math.round(meepleCount)));

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
          aria-label={`Scientifiques ${filled} sur ${MEEPLE_SLOTS}`}
        >
          {Array.from({ length: MEEPLE_SLOTS }, (_, index) => {
            const isFilled = index < filled;
            return (
              <li
                key={index}
                className={`om-colony-science-meeple ${isFilled ? "is-filled" : ""}`}
              >
                {isFilled && (
                  <ResourceIcon
                    kind="colon"
                    showTooltip={false}
                    className="om-colony-science-meeple-icon"
                    title="Scientifique"
                  />
                )}
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
