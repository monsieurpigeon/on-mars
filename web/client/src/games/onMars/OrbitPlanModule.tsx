import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ActionRoundButton } from "./ActionRoundButton";
import { BlueprintsModal } from "./BlueprintsModal";
import type { BlueprintCardId, BlueprintMarketState } from "./blueprints";

type Props = {
  label?: string;
  description?: string;
  selected?: boolean;
  blueprints: Pick<BlueprintMarketState, "rowBlue" | "rowRed">;
  onClick?: () => void;
  onTakeCard?: (cardId: BlueprintCardId) => void;
};

const SLOT_COUNT = 3;

/**
 * Module Plan (orbite) — 3 carrés + bouton Cartes (modale blueprints).
 */
export function OrbitPlanModule({
  label = "Plan",
  description = "Obtenir un plan",
  selected = false,
  blueprints,
  onClick,
  onTakeCard,
}: Props) {
  const [cardsOpen, setCardsOpen] = useState(false);
  const [portalHost, setPortalHost] = useState<Element | null>(null);

  useEffect(() => {
    setPortalHost(document.querySelector(".om-screen"));
  }, []);

  return (
    <>
      <div
        className={`om-colony-build is-orbit om-orbit-plan ${selected ? "is-selected" : ""}`}
        aria-label={description}
      >
        <div className="om-action-head">
          <span className="om-colony-build-label">{label}</span>
          <ActionRoundButton
            label={description}
            tone="orbit"
            selected={selected}
            onClick={onClick}
          />
        </div>
        <ul className="om-colony-build-slots" aria-hidden>
          {Array.from({ length: SLOT_COUNT }, (_, index) => (
            <li key={index} className="om-colony-build-slot" />
          ))}
        </ul>
        <button
          type="button"
          className="om-orbit-plan-cards-btn"
          onClick={() => setCardsOpen(true)}
        >
          Cartes
        </button>
      </div>
      {portalHost &&
        createPortal(
          <BlueprintsModal
            open={cardsOpen}
            blueprints={blueprints}
            onClose={() => setCardsOpen(false)}
            onTake={onTakeCard}
          />,
          portalHost,
        )}
    </>
  );
}
