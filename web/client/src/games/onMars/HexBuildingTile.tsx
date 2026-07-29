import type { ColonyBuildingKind } from "./colonyBuildings";
import { ColonyResourceIcon } from "./ColonyResourceIcon";
import type { ColonyResourceKind } from "./colonyResources";
import {
  hexPolygonPoints,
  type HexCell,
  type HexOrientation,
} from "./hexGrid";

export type HexBuildingFill = {
  /** Type de bâtiment — sert à détecter les complexes adjacents. */
  kind: ColonyBuildingKind;
  /** Pour les abris : chaque couleur joueur = type distinct. */
  playerIndex?: number;
  fill: string;
  ink: string;
  label?: string;
  /** Logo ressource LSS ; absent → icône abri. */
  resourceKind?: ColonyResourceKind | null;
};

export type HexBuildingLayer = "full" | "shape" | "logo";

/** Icône abri — dôme / habitat simple. */
function ShelterHexIcon({ size, title }: { size: number; title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={title ?? "Abri"}
      className="om-hex-building-icon om-hex-building-icon--shelter"
    >
      <path d="M5 15.5c0-4.2 3.1-7.6 7-7.6s7 3.4 7 7.6" />
      <path d="M4.2 15.5h15.6" />
      <path d="M10.2 15.5v-3.2c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8v3.2" />
      <circle cx="12" cy="9.2" r="1.1" />
    </svg>
  );
}

type Props = {
  cell: HexCell;
  x: number;
  y: number;
  hexSize: number;
  orientation: HexOrientation;
  building: HexBuildingFill;
  isSelected: boolean;
  isCenter?: boolean;
  /** `shape` puis liens complexes puis `logo` pour empiler correctement. */
  layer?: HexBuildingLayer;
  onSelect: () => void;
  onActivate: () => void;
};

/** Hexagonal bâtiment coloré + logo — hover / focus propres (sans écraser le fill). */
export function HexBuildingTile({
  cell,
  x,
  y,
  hexSize,
  orientation,
  building,
  isSelected,
  isCenter = false,
  layer = "full",
  onSelect,
  onActivate,
}: Props) {
  const points = hexPolygonPoints(0, 0, hexSize, orientation);
  const iconSize = hexSize * 1.1;
  const label = building.label ?? "Bâtiment";
  const showShape = layer === "full" || layer === "shape";
  const showLogo = layer === "full" || layer === "logo";
  const interactive = layer !== "logo";

  return (
    <g
      className={[
        "om-hex",
        "om-hex-building",
        isCenter ? "is-center" : "",
        isSelected ? "is-selected" : "",
        layer === "logo" ? "is-logo-layer" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      transform={`translate(${x}, ${y})`}
      role={interactive ? "gridcell" : presentationRole()}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `Hex ${cell.q}, ${cell.r} — ${label}` : undefined}
      aria-hidden={layer === "logo" ? true : undefined}
      aria-selected={interactive ? isSelected : undefined}
      onClick={
        interactive
          ? () => {
              onSelect();
              onActivate();
            }
          : undefined
      }
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
                onActivate();
              }
            }
          : undefined
      }
      style={layer === "logo" ? { pointerEvents: "none" } : undefined}
    >
      {showShape && (
        <>
          <polygon
            className="om-hex-building-shape"
            points={points}
            fill={building.fill}
          />
          <polygon
            className="om-hex-building-shine"
            points={points}
            fill="rgba(255, 255, 255, 0)"
            pointerEvents="none"
          />
        </>
      )}
      {showLogo && (
        <g
          className="om-hex-building-logo"
          style={{ color: building.ink }}
          transform={`translate(${-hexSize * 0.55}, ${-hexSize * 0.55})`}
          pointerEvents="none"
        >
          {building.resourceKind ? (
            <ColonyResourceIcon
              kind={building.resourceKind}
              size={iconSize}
              title={label}
              className="om-hex-building-icon"
            />
          ) : (
            <ShelterHexIcon size={iconSize} title={label} />
          )}
        </g>
      )}
    </g>
  );
}

function presentationRole(): undefined {
  return undefined;
}
