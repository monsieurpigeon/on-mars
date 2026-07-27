import { useId, useMemo, useState } from "react";
import type { ColonyMap } from "./colonyMap";
import type { MissionId, MissionTracker } from "./gameState";
import {
  buildHexDisk,
  cellsFromCoords,
  hexId,
  hexPolygonPoints,
  hexToPixel,
  hexViewBoxForCells,
  type HexCell,
  type HexOrientation,
} from "./hexGrid";

type Props = {
  map: ColonyMap;
  /** En mode édition : affiche aussi les hexes fantômes du canvas. */
  editMode?: boolean;
  /** Rayon du canvas d’édition (hexes cliquables fantômes). */
  editRadius?: number;
  hexSize?: number;
  pieces?: Record<string, React.ReactNode>;
  onHexClick?: (cell: HexCell, active: boolean) => void;
  className?: string;
  missions?: MissionTracker[];
  remainingMissions?: number;
  onMissionTrackerChange?: (missionId: MissionId, tracker: number) => void;
};

const MISSION_CORNERS: { id: MissionId; corner: "tl" | "tr" | "bl" }[] = [
  { id: "a", corner: "tl" },
  { id: "b", corner: "tr" },
  { id: "c", corner: "bl" },
];

/** Grille hexagonale commune — forme & orientation depuis la carte. */
export function ColonyHexGrid({
  map,
  editMode = false,
  editRadius = 5,
  hexSize = 20,
  pieces,
  onHexClick,
  className,
  missions = [],
  remainingMissions = 3,
  onMissionTrackerChange,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const fillId = `om-hex-fill-${uid}`;
  const fillActiveId = `om-hex-fill-active-${uid}`;
  const fillGhostId = `om-hex-fill-ghost-${uid}`;

  const orientation: HexOrientation = map.orientation;
  const activeIds = useMemo(
    () => new Set(map.cells.map((c) => hexId(c))),
    [map.cells],
  );

  const cells = useMemo(() => {
    if (editMode) {
      return buildHexDisk(editRadius);
    }
    return cellsFromCoords(map.cells);
  }, [editMode, editRadius, map.cells]);

  const viewCells = useMemo(() => {
    if (editMode) return buildHexDisk(editRadius);
    return map.cells;
  }, [editMode, editRadius, map.cells]);

  const view = useMemo(
    () => hexViewBoxForCells(viewCells, hexSize, orientation),
    [viewCells, hexSize, orientation],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div
      className={["om-hex-wrap", editMode ? "is-editing" : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      {!editMode && (
        <div className="om-map-corners">
          {MISSION_CORNERS.map(({ id, corner }) => {
            const mission = missions.find((m) => m.id === id);
            const tracker = mission?.tracker ?? 0;
            const goal = mission?.goal ?? 0;
            const label = mission?.label ?? `Mission ${id.toUpperCase()}`;
            return (
              <div
                key={id}
                className={`om-map-corner is-${corner}`}
                aria-label={`${label} ${tracker} sur ${goal}`}
              >
                <span className="om-map-corner-label">{label}</span>
                <div className="om-map-corner-controls">
                  <button
                    type="button"
                    className="om-map-corner-step"
                    aria-label={`Diminuer ${label}`}
                    disabled={tracker <= 0}
                    onClick={() => onMissionTrackerChange?.(id, tracker - 1)}
                  >
                    −
                  </button>
                  <span className="om-count om-map-corner-count">
                    {tracker}/{goal}
                  </span>
                  <button
                    type="button"
                    className="om-map-corner-step"
                    aria-label={`Augmenter ${label}`}
                    disabled={tracker >= goal}
                    onClick={() => onMissionTrackerChange?.(id, tracker + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
          <div
            className="om-map-corner is-br"
            aria-label={`Fin ${remainingMissions} sur 3`}
          >
            <span className="om-map-corner-label">Fin</span>
            <span className="om-count om-map-corner-count">
              {remainingMissions}/3
            </span>
          </div>
        </div>
      )}
      <svg
        className="om-hex-svg"
        viewBox={`${view.minX} ${view.minY} ${view.width} ${view.height}`}
        role="grid"
        aria-label={
          editMode
            ? "Éditeur de carte hexagonale"
            : "Grille hexagonale de la colonie"
        }
      >
        <defs>
          <radialGradient id={fillId} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="rgba(228, 87, 46, 0.22)" />
            <stop offset="55%" stopColor="rgba(42, 22, 16, 0.85)" />
            <stop offset="100%" stopColor="rgba(12, 7, 5, 0.95)" />
          </radialGradient>
          <radialGradient id={fillActiveId} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="rgba(228, 87, 46, 0.45)" />
            <stop offset="100%" stopColor="rgba(12, 7, 5, 0.95)" />
          </radialGradient>
          <radialGradient id={fillGhostId} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="rgba(232, 210, 176, 0.06)" />
            <stop offset="100%" stopColor="rgba(12, 7, 5, 0.35)" />
          </radialGradient>
        </defs>

        {cells.map((cell) => {
          const { x, y } = hexToPixel(cell, hexSize, orientation);
          const active = activeIds.has(cell.id);
          const isCenter = cell.q === 0 && cell.r === 0;
          const isSelected = selectedId === cell.id;
          const piece = active ? pieces?.[cell.id] : undefined;
          const ghost = editMode && !active;

          if (!editMode && !active) return null;

          return (
            <g
              key={cell.id}
              className={[
                "om-hex",
                ghost ? "is-ghost" : "",
                active ? "is-active-cell" : "",
                isCenter ? "is-center" : "",
                isSelected ? "is-selected" : "",
                piece ? "has-piece" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              transform={`translate(${x}, ${y})`}
              role="gridcell"
              tabIndex={0}
              aria-label={`Hex ${cell.q}, ${cell.r}${active ? "" : " (vide)"}`}
              aria-pressed={editMode ? active : undefined}
              onClick={() => {
                setSelectedId(cell.id);
                onHexClick?.(cell, active);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedId(cell.id);
                  onHexClick?.(cell, active);
                }
              }}
            >
              <polygon
                className="om-hex-shape"
                points={hexPolygonPoints(0, 0, hexSize - 1.1, orientation)}
                fill={
                  ghost
                    ? `url(#${fillGhostId})`
                    : isSelected
                      ? `url(#${fillActiveId})`
                      : `url(#${fillId})`
                }
                stroke={
                  ghost
                    ? "rgba(232, 210, 176, 0.14)"
                    : isSelected
                      ? "var(--view-player, #e4572e)"
                      : isCenter
                        ? "rgba(228, 87, 46, 0.55)"
                        : "rgba(232, 210, 176, 0.28)"
                }
                strokeWidth={ghost ? 0.8 : isSelected ? 1.6 : isCenter ? 1.35 : 1}
                strokeDasharray={ghost ? "2 2" : undefined}
              />
              <text
                className="om-hex-coord"
                textAnchor="middle"
                dominantBaseline="central"
                y={0.5}
              >
                {cell.q},{cell.r}
              </text>
              <g className="om-hex-slot" aria-hidden={!piece}>
                {piece ?? null}
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
