import { useState } from "react";
import { ColonyResourceIcon } from "./ColonyResourceIcon";
import {
  COLONY_RESOURCE_LABELS,
  colonyResourceClass,
  type PlayerResources,
} from "./colonyResources";
import { ActionRoundButton } from "./ActionRoundButton";
import {
  TECH_KIND_LABELS,
  TECH_MARKET_ROW_COUNTS,
  TECH_TOP_PAY_RESOURCES,
  affordableTopPayOptions,
  canAffordAnyTechRow,
  techKindClass,
  techMarketRowForSlot,
  type TechKind,
  type TechMarketState,
  type TechTopPayResource,
} from "./techs";
import { TechTileIcon } from "./TechTileIcon";

type Props = {
  label?: string;
  description?: string;
  selected?: boolean;
  market: TechMarketState;
  resources: PlayerResources;
  onClick?: () => void;
  onTakeTech?: (kind: TechKind, payResource?: TechTopPayResource) => void;
};

const ROW_COST_LABELS = [
  "1 O₂ + 1 ressource (énergie, eau, plante ou oxygène)",
  "1 oxygène",
  "Gratuit",
] as const;

/**
 * Module Techno — 8 hexagones flat en 3 / 3 / 2, tuiles piochées au hasard.
 * Ligne haute : choix de la 2ᵉ ressource avant confirmation.
 */
export function OrbitTechModule({
  label = "Techno",
  description = "Apprendre une nouvelle techno",
  selected = false,
  market,
  resources,
  onClick,
  onTakeTech,
}: Props) {
  const [pendingKind, setPendingKind] = useState<TechKind | null>(null);
  let slotIndex = 0;
  const topOptions = affordableTopPayOptions(resources);

  function handleTileClick(kind: TechKind, row: number) {
    if (!onTakeTech) return;
    if (row === 2) {
      setPendingKind(null);
      onTakeTech(kind);
      return;
    }
    if (row === 1) {
      if (!canAffordAnyTechRow(resources, 1)) return;
      setPendingKind(null);
      onTakeTech(kind);
      return;
    }
    // Ligne haute : sélectionner d’abord la ressource bonus.
    if (topOptions.length === 0) return;
    if (topOptions.length === 1) {
      setPendingKind(null);
      onTakeTech(kind, topOptions[0]);
      return;
    }
    setPendingKind((prev) => (prev === kind ? null : kind));
  }

  function confirmTopPay(pay: TechTopPayResource) {
    if (!pendingKind || !onTakeTech) return;
    onTakeTech(pendingKind, pay);
    setPendingKind(null);
  }

  return (
    <div
      className={`om-orbit-tech ${selected ? "is-selected" : ""}`}
      aria-label={description}
    >
      <div className="om-action-head">
        <span className="om-orbit-tech-label">{label}</span>
        <ActionRoundButton
          label={description}
          tone="orbit"
          selected={selected}
          onClick={onClick}
        />
      </div>
      <div className="om-orbit-tech-grid">
        {TECH_MARKET_ROW_COUNTS.map((count, row) => {
          const afford = canAffordAnyTechRow(resources, row);
          return (
            <div key={row} className="om-orbit-tech-row-wrap">
              <div
                className="om-orbit-tech-row-cost"
                title={ROW_COST_LABELS[row]}
                aria-label={`Coût : ${ROW_COST_LABELS[row]}`}
              >
                {row === 2 ? (
                  <span className="om-orbit-tech-free">0</span>
                ) : (
                  <>
                    <span
                      className={`om-orbit-tech-cost-chip ${colonyResourceClass("oxygene")}`}
                    >
                      <ColonyResourceIcon kind="oxygene" size="100%" />
                    </span>
                    {row === 0 ? (
                      <>
                        <span className="om-orbit-tech-cost-plus" aria-hidden>
                          +
                        </span>
                        <span className="om-orbit-tech-cost-any" aria-hidden>
                          ?
                        </span>
                      </>
                    ) : null}
                  </>
                )}
              </div>
              <ul className="om-orbit-tech-row">
                {Array.from({ length: count }, () => {
                  const index = slotIndex++;
                  const kind = market.slots[index] ?? null;
                  if (!kind) {
                    return (
                      <li
                        key={index}
                        className="om-orbit-tech-hex is-empty"
                        aria-label="Case techno vide"
                      />
                    );
                  }
                  const isPending = pendingKind === kind;
                  const disabled =
                    !onTakeTech ||
                    !afford ||
                    (row === 0 && topOptions.length === 0);
                  return (
                    <li key={index}>
                      <button
                        type="button"
                        className={[
                          "om-orbit-tech-hex",
                          techKindClass(kind),
                          isPending ? "is-pending" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        aria-label={`Prendre techno ${TECH_KIND_LABELS[kind]} — ${ROW_COST_LABELS[row]}`}
                        disabled={disabled}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTileClick(kind, techMarketRowForSlot(index));
                        }}
                      >
                        <TechTileIcon kind={kind} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      {pendingKind ? (
        <div
          className="om-orbit-tech-pay"
          role="group"
          aria-label="Choisir la ressource à payer en plus de l’oxygène"
        >
          {TECH_TOP_PAY_RESOURCES.map((res) => {
            const ok = topOptions.includes(res);
            return (
              <button
                key={res}
                type="button"
                className={`om-orbit-tech-pay-btn ${colonyResourceClass(res)}`}
                disabled={!ok}
                aria-label={`Payer ${COLONY_RESOURCE_LABELS[res]}`}
                onClick={(e) => {
                  e.stopPropagation();
                  confirmTopPay(res);
                }}
              >
                <ColonyResourceIcon kind={res} size="100%" />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
