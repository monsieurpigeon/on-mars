import type { ReactNode } from "react";
import { ColonyResourceIcon } from "./ColonyResourceIcon";
import { ResourceIcon } from "./ResourceIcon";
import { RocketIcon } from "./RocketIcon";
import {
  TECH_KIND_LABELS,
  techKindClass,
  type TechKind,
} from "./techs";

type Props = {
  kind: TechKind;
  size?: number | string;
  className?: string;
};

/** Icône d’une tuile techno (ressources LSS / rover / fusée / bâtiment). */
export function TechTileIcon({ kind, size = "100%", className }: Props) {
  const label = TECH_KIND_LABELS[kind];
  let glyph: ReactNode;
  switch (kind) {
    case "minerai":
    case "energie":
    case "eau":
    case "plante":
    case "oxygene":
      glyph = (
        <ColonyResourceIcon kind={kind} size={size} title={label} />
      );
      break;
    case "rover":
      glyph = (
        <ResourceIcon
          kind="rover"
          size={size}
          title={label}
          showTooltip={false}
        />
      );
      break;
    case "fusee":
      glyph = <RocketIcon size={size} title={label} />;
      break;
    case "batiment":
      glyph = (
        <ResourceIcon
          kind="advanced_building"
          size={size}
          title={label}
          showTooltip={false}
        />
      );
      break;
  }

  return (
    <span
      className={["om-tech-tile-icon", techKindClass(kind), className]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    >
      {glyph}
    </span>
  );
}
