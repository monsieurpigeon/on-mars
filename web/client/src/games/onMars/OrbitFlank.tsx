import { useState } from "react";
import { ColonyBuildSlots } from "./ColonyBuildSlots";
import { OrbitCapsuleModule } from "./OrbitCapsuleModule";
import { OrbitPlanModule } from "./OrbitPlanModule";
import { ORBIT_MODULES, type OrbitModule, type OrbitModuleId } from "./orbitModules";
import { OrbitStock } from "./OrbitStock";
import { OrbitTechModule } from "./OrbitTechModule";
import type { BlueprintCardId, BlueprintMarketState } from "./blueprints";
import type { PlayerResources } from "./colonyResources";
import type { OrbitBank, OrbitBankKind } from "./gameState";
import type { TechKind, TechMarketState, TechTopPayResource } from "./techs";

type Props = {
  bank: OrbitBank;
  blueprints: Pick<BlueprintMarketState, "rowBlue" | "rowRed">;
  techMarket: TechMarketState;
  resources: PlayerResources;
  takeDisabled?: boolean;
  onTake?: (kind: OrbitBankKind) => void;
  onTakeBlueprint?: (cardId: BlueprintCardId) => void;
  onTakeTech?: (kind: TechKind, payResource?: TechTopPayResource) => void;
};

function moduleById(id: OrbitModule["id"]): OrbitModule {
  return ORBIT_MODULES.find((m) => m.id === id)!;
}

const CAPSULE = moduleById("landing_pod");
const PLAN = moduleById("obtain_blueprint");
const TECH = moduleById("learn_tech");
const RD = moduleById("research_develop");
const STOCK = moduleById("stock");

/** Zone Orbite — modules d’action + banque stock. */
export function OrbitFlank({
  bank,
  blueprints,
  techMarket,
  resources,
  takeDisabled = false,
  onTake,
  onTakeBlueprint,
  onTakeTech,
}: Props) {
  const [selectedAction, setSelectedAction] = useState<OrbitModuleId | null>(
    null,
  );

  function selectAction(id: OrbitModuleId) {
    setSelectedAction((prev) => (prev === id ? null : id));
  }

  return (
    <div className="om-board-flank om-flank-orbit" aria-label="Zone Orbite">
      <div className="om-flank-cols om-orbit-flank-body">
        <div className="om-side-col om-orbit-col">
          <ul className="om-side-col-list om-orbit-list">
            <li className="om-side-slot om-orbit-capsule-slot">
              <OrbitCapsuleModule
                label={CAPSULE.short}
                description={CAPSULE.label}
                selected={selectedAction === CAPSULE.id}
                onClick={() => selectAction(CAPSULE.id)}
              />
            </li>
            <li className="om-side-slot om-orbit-tech-slot">
              <OrbitTechModule
                label={TECH.short}
                description={TECH.label}
                selected={selectedAction === TECH.id}
                market={techMarket}
                resources={resources}
                onClick={() => selectAction(TECH.id)}
                onTakeTech={onTakeTech}
              />
            </li>
            <li className="om-side-slot om-orbit-slot-row om-orbit-rd-slot">
              <ColonyBuildSlots
                label={RD.short}
                description={RD.label}
                tone="orbit"
                selected={selectedAction === RD.id}
                onClick={() => selectAction(RD.id)}
              />
            </li>
            <li className="om-side-slot om-orbit-slot-row om-orbit-plan-slot">
              <OrbitPlanModule
                label={PLAN.short}
                description={PLAN.label}
                selected={selectedAction === PLAN.id}
                blueprints={blueprints}
                onClick={() => selectAction(PLAN.id)}
                onTakeCard={onTakeBlueprint}
              />
            </li>
          </ul>
        </div>
        <OrbitStock
          bank={bank}
          disabled={takeDisabled}
          selected={selectedAction === STOCK.id}
          onClick={() => selectAction(STOCK.id)}
          onTake={onTake}
        />
      </div>
    </div>
  );
}
