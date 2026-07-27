import { useState } from "react";
import { ColonyBuildSlots } from "./ColonyBuildSlots";
import { OrbitCapsuleModule } from "./OrbitCapsuleModule";
import { ORBIT_MODULES, type OrbitModule, type OrbitModuleId } from "./orbitModules";
import { OrbitStock } from "./OrbitStock";
import { OrbitTechModule } from "./OrbitTechModule";
import type { OrbitBank, OrbitBankKind } from "./gameState";

type Props = {
  bank: OrbitBank;
  takeDisabled?: boolean;
  onTake?: (kind: OrbitBankKind) => void;
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
export function OrbitFlank({ bank, takeDisabled = false, onTake }: Props) {
  const [selectedAction, setSelectedAction] = useState<OrbitModuleId | null>(
    null,
  );

  function selectAction(id: OrbitModuleId) {
    setSelectedAction((prev) => (prev === id ? null : id));
  }

  return (
    <div className="om-board-flank om-flank-orbit" aria-label="Zone Orbite">
      <span className="om-flank-title">Orbite</span>
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
            <li className="om-side-slot om-orbit-slot-row">
              <ColonyBuildSlots
                label={PLAN.short}
                description={PLAN.label}
                tone="orbit"
                selected={selectedAction === PLAN.id}
                onClick={() => selectAction(PLAN.id)}
              />
            </li>
            <li className="om-side-slot om-orbit-tech-slot">
              <OrbitTechModule
                label={TECH.short}
                description={TECH.label}
                selected={selectedAction === TECH.id}
                onClick={() => selectAction(TECH.id)}
              />
            </li>
            <li className="om-side-slot om-orbit-slot-row">
              <ColonyBuildSlots
                label={RD.short}
                description={RD.label}
                tone="orbit"
                selected={selectedAction === RD.id}
                onClick={() => selectAction(RD.id)}
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
