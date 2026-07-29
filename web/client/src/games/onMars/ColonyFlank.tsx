import { useState } from "react";
import { ColonyBuildSlots } from "./ColonyBuildSlots";
import { ColonyLssPanel } from "./ColonyLssPanel";
import { ColonyRoundSlot } from "./ColonyRoundSlot";
import { ColonyScienceModule } from "./ColonyScienceModule";
import { COLONY_MODULES, type ColonyModule, type ColonyModuleId } from "./colonyModules";
import type { LssRewardId } from "./lssRewards";
import type {
  LssPlayerTokens,
  LssResourceTrack,
  LssTrackResource,
} from "./lssResourceTrack";
import type { ScientistMarketState, ScientistResource } from "./scientists";

type Props = {
  lssLevel: number;
  lssRewardRow: LssRewardId[];
  lssResourceTrack: LssResourceTrack;
  lssPlayerTokens: LssPlayerTokens;
  scientistMarket: ScientistMarketState;
  onAdvanceResource?: (resource: LssTrackResource) => void;
  onTakeScientist?: (resource: ScientistResource) => void;
};

function moduleById(id: ColonyModule["id"]): ColonyModule {
  return COLONY_MODULES.find((m) => m.id === id)!;
}

const CONSTRUCT = moduleById("construct_building");
const UPGRADE = moduleById("upgrade_building");
const SCIENCE = moduleById("hire_scientist");
const CONTROL = moduleById("control_center");
const SHIP = moduleById("welcome_ship");

/** Zone Colonie — systèmes de survie + modules d’action. */
export function ColonyFlank({
  lssLevel,
  lssRewardRow,
  lssResourceTrack,
  lssPlayerTokens,
  scientistMarket,
  onAdvanceResource,
  onTakeScientist,
}: Props) {
  const [selectedAction, setSelectedAction] = useState<ColonyModuleId | null>(
    null,
  );

  function selectAction(id: ColonyModuleId) {
    setSelectedAction((prev) => (prev === id ? null : id));
  }

  return (
    <div className="om-board-flank om-flank-colony" aria-label="Zone Colonie">
      <div className="om-flank-cols om-colony-flank-body">
        <div className="om-side-col om-colony-col">
          <div className="om-colony-build-row" aria-label="Construction et amélioration">
            <ColonyBuildSlots
              label={CONSTRUCT.short}
              description={CONSTRUCT.label}
              selected={selectedAction === CONSTRUCT.id}
              onClick={() => selectAction(CONSTRUCT.id)}
            />
            <ColonyBuildSlots
              label={UPGRADE.short}
              description={UPGRADE.label}
              selected={selectedAction === UPGRADE.id}
              onClick={() => selectAction(UPGRADE.id)}
            />
          </div>
          <ul className="om-side-col-list om-colony-list">
            <li className="om-side-slot om-colony-science-row">
              <ColonyScienceModule
                label={SCIENCE.short}
                description={SCIENCE.label}
                market={scientistMarket}
                selected={selectedAction === SCIENCE.id}
                onClick={() => selectAction(SCIENCE.id)}
                onTakeScientist={onTakeScientist}
              />
            </li>
            <li className="om-side-slot om-colony-round-row">
              <div className="om-colony-build-row" aria-label="Contrôle et vaisseau">
                <ColonyRoundSlot
                  label={CONTROL.short}
                  description={CONTROL.label}
                  selected={selectedAction === CONTROL.id}
                  onClick={() => selectAction(CONTROL.id)}
                />
                <ColonyRoundSlot
                  label={SHIP.short}
                  description={SHIP.label}
                  selected={selectedAction === SHIP.id}
                  onClick={() => selectAction(SHIP.id)}
                />
              </div>
            </li>
          </ul>
        </div>
        <div className="om-side-col om-colony-survival" aria-label="Systèmes de survie">
          <ColonyLssPanel
            lssLevel={lssLevel}
            lssRewardRow={lssRewardRow}
            lssResourceTrack={lssResourceTrack}
            lssPlayerTokens={lssPlayerTokens}
            onAdvanceResource={onAdvanceResource}
          />
        </div>
      </div>
    </div>
  );
}
