import type { SVGProps } from "react";
import { FuturisticTooltip, type TooltipSide } from "./FuturisticTooltip";

export const RESOURCE_KINDS = [
  "colon",
  "robot",
  "rover",
  "advanced_building",
] as const;

export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const RESOURCE_LABELS: Record<ResourceKind, string> = {
  colon: "Colon",
  robot: "Robot",
  rover: "Rover",
  advanced_building: "Bâtiment avancé",
};

type Props = {
  kind: ResourceKind;
  size?: number | string;
  /** Texte du tooltip (défaut = label de la ressource). */
  title?: string;
  /** Côté du tooltip attaché à l’icône. */
  tooltipSide?: TooltipSide;
  /** Désactive le tooltip (ex. contexte déjà libellé). */
  showTooltip?: boolean;
} & Omit<SVGProps<SVGSVGElement>, "children">;

function ColonGlyph() {
  /* Silhouette pleine type pion / meeple */
  return (
    <g fill="currentColor" stroke="none">
      <circle cx="12" cy="5.6" r="2.85" />
      <path d="M8.1 10.1c1.15-.95 2.5-1.45 3.9-1.45s2.75.5 3.9 1.45l2.7 2.15c.6.48.48 1.4-.22 1.7L15.9 15.1v3.15c0 .6-.5 1.1-1.1 1.1H9.2c-.6 0-1.1-.5-1.1-1.1v-3.15L5.62 13.95c-.7-.3-.82-1.22-.22-1.7L8.1 10.1Z" />
    </g>
  );
}

function RobotGlyph() {
  return (
    <>
      <rect x="7" y="8" width="10" height="9" rx="1.4" />
      <circle cx="10" cy="12" r="1.1" />
      <circle cx="14" cy="12" r="1.1" />
      <path d="M12 5.5v2.2M9.5 17v2M14.5 17v2M7 11.5H5.2M19 11.5h-1.8" />
      <path d="M9.5 14.8h5" />
    </>
  );
}

function RoverGlyph() {
  return (
    <>
      <path d="M5.5 14.5h13l-1.4-4.2a1.6 1.6 0 0 0-1.5-1.1H9.2a1.6 1.6 0 0 0-1.5 1L5.5 14.5Z" />
      <circle cx="8.2" cy="17.2" r="1.8" />
      <circle cx="15.8" cy="17.2" r="1.8" />
      <path d="M10.2 9.2V7.4h3.6v1.8M12 7.4V5.6" />
      <circle cx="12" cy="5.2" r="0.9" />
    </>
  );
}

function AdvancedBuildingGlyph() {
  return (
    <>
      <path d="M6 19.5V9.2L12 4.8l6 4.4v10.3" />
      <path d="M9.2 19.5V12h5.6v7.5" />
      <path d="M10.4 14.2h1.2M12.4 14.2h1.2M10.4 16.4h1.2M12.4 16.4h1.2" />
      <path d="M12 4.8v2.8" />
      <circle cx="12" cy="3.6" r="0.9" />
    </>
  );
}

const GLYPHS: Record<ResourceKind, () => React.ReactNode> = {
  colon: ColonGlyph,
  robot: RobotGlyph,
  rover: RoverGlyph,
  advanced_building: AdvancedBuildingGlyph,
};

/** Icône unique pour les ressources humaines — toujours importer ce composant. */
export function ResourceIcon({
  kind,
  size = "100%",
  title,
  tooltipSide = "left",
  showTooltip = true,
  className,
  ...rest
}: Props) {
  const Glyph = GLYPHS[kind];
  const label = title ?? RESOURCE_LABELS[kind];

  const icon = (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={label}
      className={["om-resource-icon", `om-resource-icon--${kind}`, className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      <Glyph />
    </svg>
  );

  if (!showTooltip) return icon;

  return (
    <FuturisticTooltip content={label} side={tooltipSide} className="om-resource-tooltip">
      {icon}
    </FuturisticTooltip>
  );
}
