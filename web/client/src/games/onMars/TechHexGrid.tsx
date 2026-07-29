import { useMemo, type CSSProperties } from "react";
import { ColonyResourceIcon } from "./ColonyResourceIcon";
import { CrystalIcon } from "./CrystalIcon";
import { colonyResourceClass } from "./colonyResources";
import {
  hexId,
  hexPolygonPoints,
  hexToPixel,
} from "./hexGrid";
import {
  TECH_COLUMN_COSTS,
  TECH_COLUMN_COST_LABELS,
  TECH_COLUMN_QS,
  TECH_COLUMN_VP,
  TECH_HEX_CELLS,
  type TechColumnCost,
  type TechColumnQ,
} from "./techMap";
import {
  TECH_KIND_LABELS,
  canAdvanceTechRight,
  leftmostAvailableTechSlots,
  techAdvanceRightTargets,
  techKindClass,
  type TechKind,
  type TechPlacement,
} from "./techs";
import { SaturnIcon } from "./SaturnIcon";
import { TechTileIcon } from "./TechTileIcon";

const ORIENTATION = "flat" as const;
const HEX_SIZE = 18;
/** Aplatissement vertical des hexes (1 = régulier). */
const Y_SCALE = 0.82;
/** Écarte les colonnes (gap horizontal entre hexes). */
const GAP_X = 1.32;
/** Réduit le dessin pour laisser un espace autour de chaque hex. */
const HEX_DRAW = HEX_SIZE * 0.82;
const ICON_SIZE = HEX_DRAW * 0.92;
const COST_ICON = 11;
const COST_ROW_H = 18;
const COST_FO_W = 44;
const VP_ROW_H = 16;
const VP_FO_W = 36;
const VIEW_PAD = 2;
const COST_TOP_PAD = 24;
const VP_BOTTOM_PAD = 22;

function techHexPixel(cell: { q: number; r: number }) {
  const { x, y } = hexToPixel(cell, HEX_SIZE, ORIENTATION, Y_SCALE);
  return { x: x * GAP_X, y };
}

type Props = {
  techs?: TechPlacement[];
  /** Cases cliquables pour placer la techno en cours. */
  placeable?: boolean;
  onPlace?: (q: number, r: number) => void;
  /** Techno sélectionnée pour choisir haut/bas. */
  advancingKind?: TechKind | null;
  onSelectAdvance?: (kind: TechKind) => void;
  onAdvanceTo?: (q: number, r: number) => void;
};

function ColumnCostIcons({ cost }: { cost: TechColumnCost }) {
  switch (cost.type) {
    case "free":
      return <span className="om-tech-col-free">0</span>;
    case "any_lss":
      return <span className="om-tech-col-any">?</span>;
    case "oxygene":
      return (
        <span className={`om-tech-col-chip ${colonyResourceClass("oxygene")}`}>
          <ColonyResourceIcon kind="oxygene" size="100%" />
        </span>
      );
    case "oxygene_any_lss":
      return (
        <>
          <span className={`om-tech-col-chip ${colonyResourceClass("oxygene")}`}>
            <ColonyResourceIcon kind="oxygene" size="100%" />
          </span>
          <span className="om-tech-col-plus" aria-hidden>
            +
          </span>
          <span className="om-tech-col-any">?</span>
        </>
      );
    case "oxygene_cristal":
      return (
        <>
          <span className={`om-tech-col-chip ${colonyResourceClass("oxygene")}`}>
            <ColonyResourceIcon kind="oxygene" size="100%" />
          </span>
          <span className="om-tech-col-plus" aria-hidden>
            +
          </span>
          <span className="om-tech-col-chip om-tech-col-chip--cristal">
            <CrystalIcon size="100%" />
          </span>
        </>
      );
  }
}

/** Petite grille Tech — colony-base-centered (flat), hexes un peu aplatis. */
export function TechHexGrid({
  techs = [],
  placeable = false,
  onPlace,
  advancingKind = null,
  onSelectAdvance,
  onAdvanceTo,
}: Props) {
  const baseView = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const hw = HEX_DRAW;
    const hh = (Math.sqrt(3) / 2) * HEX_DRAW * Y_SCALE;
    for (const cell of TECH_HEX_CELLS) {
      const { x, y } = techHexPixel(cell);
      minX = Math.min(minX, x - hw);
      maxX = Math.max(maxX, x + hw);
      minY = Math.min(minY, y - hh);
      maxY = Math.max(maxY, y + hh);
    }
    return {
      minX: minX - VIEW_PAD,
      minY: minY - VIEW_PAD,
      width: maxX - minX + VIEW_PAD * 2,
      height: maxY - minY + VIEW_PAD * 2,
    };
  }, []);

  const view = useMemo(
    () => ({
      ...baseView,
      minY: baseView.minY - COST_TOP_PAD,
      height: baseView.height + COST_TOP_PAD + VP_BOTTOM_PAD,
    }),
    [baseView],
  );

  const columns = useMemo(() => {
    const costY = baseView.minY - COST_TOP_PAD / 2;
    const vpY = baseView.minY + baseView.height + VP_BOTTOM_PAD / 2;
    return TECH_COLUMN_QS.map((q) => {
      const cells = TECH_HEX_CELLS.filter((c) => c.q === q);
      let sumX = 0;
      for (const cell of cells) {
        const { x } = techHexPixel(cell);
        sumX += x;
      }
      return {
        q: q as TechColumnQ,
        x: cells.length ? sumX / cells.length : 0,
        costY,
        vpY,
        cost: TECH_COLUMN_COSTS[q],
        vp: TECH_COLUMN_VP[q],
      };
    });
  }, [baseView.height, baseView.minY]);

  const byCell = useMemo(() => {
    const map = new Map<string, TechPlacement>();
    for (const placement of techs) {
      map.set(hexId(placement), placement);
    }
    return map;
  }, [techs]);

  const placeTargets = useMemo(() => {
    if (!placeable) return new Set<string>();
    return new Set(leftmostAvailableTechSlots(techs).map((c) => hexId(c)));
  }, [placeable, techs]);

  const advanceTargets = useMemo(() => {
    if (!advancingKind) return new Set<string>();
    return new Set(
      techAdvanceRightTargets(techs, advancingKind).map((c) => hexId(c)),
    );
  }, [advancingKind, techs]);

  return (
    <div
      className={[
        "om-tech-hex-wrap",
        placeable ? "is-placing" : "",
        advancingKind ? "is-advancing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={
        placeable
          ? "Choisir une case de départ à gauche pour placer la techno"
          : advancingKind
            ? "Choisir haut ou bas pour faire évoluer la techno"
            : undefined
      }
    >
      <svg
        className="om-tech-hex-svg"
        viewBox={`${view.minX} ${view.minY} ${view.width} ${view.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="grid"
        aria-label="Grille hexagonale Tech"
        style={
          {
            ["--om-tech-aspect" as string]: `${view.width} / ${view.height}`,
          } as CSSProperties
        }
      >
        {columns.map((col) => (
          <foreignObject
            key={`cost-${col.q}`}
            x={col.x - COST_FO_W / 2}
            y={col.costY - COST_ROW_H / 2}
            width={COST_FO_W}
            height={COST_ROW_H}
            className="om-tech-col-cost-fo"
          >
            <div
              className="om-tech-col-cost"
              title={TECH_COLUMN_COST_LABELS[col.cost.type]}
              aria-label={`Colonne : ${TECH_COLUMN_COST_LABELS[col.cost.type]}`}
              style={{ ["--om-tech-cost-icon" as string]: `${COST_ICON}px` }}
            >
              <ColumnCostIcons cost={col.cost} />
            </div>
          </foreignObject>
        ))}

        {columns.map((col) => (
          <foreignObject
            key={`vp-${col.q}`}
            x={col.x - VP_FO_W / 2}
            y={col.vpY - VP_ROW_H / 2}
            width={VP_FO_W}
            height={VP_ROW_H}
            className="om-tech-col-vp-fo"
          >
            <div
              className="om-tech-col-vp"
              aria-label={`${col.vp} point${col.vp > 1 ? "s" : ""} de victoire`}
              title={`${col.vp} PV`}
            >
              <span className="om-tech-col-vp-num">{col.vp}</span>
              <SaturnIcon size="0.7em" className="om-tech-col-vp-icon" />
            </div>
          </foreignObject>
        ))}

        {TECH_HEX_CELLS.map((cell) => {
          const { x, y } = techHexPixel(cell);
          const tech = byCell.get(cell.id);
          const canPlace = placeTargets.has(cell.id);
          const canAdvanceTo = advanceTargets.has(cell.id);
          const canSelect =
            !placeable &&
            !advancingKind &&
            !!tech &&
            !!onSelectAdvance &&
            canAdvanceTechRight(techs, tech.kind);
          const isAdvancingSource =
            !!tech && advancingKind != null && tech.kind === advancingKind;
          const clickable = canPlace || canAdvanceTo || canSelect;
          return (
            <g
              key={cell.id}
              className={[
                "om-tech-hex",
                tech ? `has-tech ${techKindClass(tech.kind)}` : "",
                canPlace || canAdvanceTo ? "is-place-target" : "",
                canSelect ? "is-advanceable" : "",
                isAdvancingSource ? "is-advancing-source" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              transform={`translate(${x}, ${y})`}
              role="gridcell"
              aria-label={
                tech
                  ? canSelect
                    ? `Choisir direction pour ${TECH_KIND_LABELS[tech.kind]}`
                    : `Tech ${TECH_KIND_LABELS[tech.kind]}`
                  : canAdvanceTo
                    ? `Évoluer ici ${cell.q}, ${cell.r}`
                    : canPlace
                      ? `Placer ici ${cell.q}, ${cell.r}`
                      : `Tech ${cell.q}, ${cell.r}`
              }
              onClick={
                canPlace && onPlace
                  ? () => onPlace(cell.q, cell.r)
                  : canAdvanceTo && onAdvanceTo
                    ? () => onAdvanceTo(cell.q, cell.r)
                    : canSelect && tech
                      ? () => onSelectAdvance?.(tech.kind)
                      : undefined
              }
              style={clickable ? { cursor: "pointer" } : undefined}
            >
              <polygon
                className="om-tech-hex-shape"
                points={hexPolygonPoints(
                  0,
                  0,
                  HEX_DRAW,
                  ORIENTATION,
                  Y_SCALE,
                )}
              />
              {tech ? (
                <foreignObject
                  x={-ICON_SIZE / 2}
                  y={-ICON_SIZE / 2}
                  width={ICON_SIZE}
                  height={ICON_SIZE}
                  className="om-tech-hex-icon-fo"
                >
                  <div className="om-tech-hex-icon-wrap">
                    <TechTileIcon kind={tech.kind} size="100%" />
                  </div>
                </foreignObject>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
