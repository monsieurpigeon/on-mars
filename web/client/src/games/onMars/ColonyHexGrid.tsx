import { useId, useMemo, useState } from "react";
import type { ColonyMap } from "./colonyMap";
import type { ColonyRover, MissionId, MissionTracker } from "./gameState";
import { getPlayer } from "./players";
import { HexBuildingTile } from "./HexBuildingTile";
import type { HexBuildingFill } from "./HexBuildingTile";
import { HexBuildingComplexLinks } from "./HexBuildingComplexLinks";
import { ResourceIcon } from "./ResourceIcon";
import {
  buildHexDisk,
  cellsFromCoords,
  hexId,
  hexPolygonPoints,
  hexToPixel,
  hexViewBoxForCells,
  uniqueHexEdges,
  type HexCell,
  type HexOrientation,
} from "./hexGrid";

export type { HexBuildingFill } from "./HexBuildingTile";

type Props = {
  map: ColonyMap;
  /** En mode édition : affiche aussi les hexes fantômes du canvas. */
  editMode?: boolean;
  /** Rayon du canvas d’édition (hexes cliquables fantômes). */
  editRadius?: number;
  hexSize?: number;
  /** Remplissage solide + logo d’un hex (bâtiments). */
  cellFills?: Record<string, HexBuildingFill>;
  /** Rovers sur la grille. */
  rovers?: ColonyRover[];
  /** Cases cliquables pour déplacer le rover du joueur actif. */
  moveTargetIds?: ReadonlySet<string>;
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
  cellFills,
  rovers = [],
  moveTargetIds,
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

  const visibleCells = useMemo(() => {
    if (editMode) return cells;
    return cells.filter((c) => activeIds.has(c.id));
  }, [editMode, cells, activeIds]);

  const gridEdges = useMemo(
    () => uniqueHexEdges(visibleCells, hexSize, orientation),
    [visibleCells, hexSize, orientation],
  );

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
                <span className="om-map-corner-badge" aria-hidden>
                  {id.toUpperCase()}
                </span>
                <div className="om-map-corner-body">
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
              </div>
            );
          })}
          <div
            className="om-map-corner is-br is-fin"
            aria-label={`Fin ${remainingMissions} sur 3`}
          >
            <span className="om-map-corner-badge" aria-hidden>
              F
            </span>
            <div className="om-map-corner-body">
              <span className="om-map-corner-label">Fin</span>
              <span className="om-count om-map-corner-count">
                {remainingMissions}/3
              </span>
            </div>
          </div>
        </div>
      )}
      <div className="om-hex-hud">
        <div className="om-hex-hud-frame" aria-hidden>
          <span className="om-hex-hud-bracket is-tl" />
          <span className="om-hex-hud-bracket is-tr" />
          <span className="om-hex-hud-bracket is-bl" />
          <span className="om-hex-hud-bracket is-br" />
        </div>
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
            <linearGradient id={fillId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.07)" />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0.02)" />
            </linearGradient>
            <linearGradient id={fillActiveId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(200, 230, 255, 0.16)" />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0.06)" />
            </linearGradient>
            <linearGradient id={fillGhostId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.03)" />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0.01)" />
            </linearGradient>
          </defs>

          {visibleCells.map((cell) => {
            const { x, y } = hexToPixel(cell, hexSize, orientation);
            const active = activeIds.has(cell.id);
            const isCenter = cell.q === 0 && cell.r === 0;
            const isSelected = selectedId === cell.id;
            const building = active ? cellFills?.[cell.id] : undefined;
            const ghost = editMode && !active;

            if (building) {
              return (
                <HexBuildingTile
                  key={`shape-${cell.id}`}
                  cell={cell}
                  x={x}
                  y={y}
                  hexSize={hexSize}
                  orientation={orientation}
                  building={building}
                  isSelected={isSelected}
                  isCenter={isCenter}
                  layer="shape"
                  onSelect={() => setSelectedId(cell.id)}
                  onActivate={() => onHexClick?.(cell, active)}
                />
              );
            }

            return (
              <g
                key={cell.id}
                className={[
                  "om-hex",
                  ghost ? "is-ghost" : "",
                  active ? "is-active-cell" : "",
                  isCenter ? "is-center" : "",
                  isSelected ? "is-selected" : "",
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
                  points={hexPolygonPoints(0, 0, hexSize, orientation)}
                  fill={
                    ghost
                      ? `url(#${fillGhostId})`
                      : isSelected
                        ? `url(#${fillActiveId})`
                        : `url(#${fillId})`
                  }
                  stroke="none"
                />
                <text
                  className="om-hex-coord"
                  textAnchor="middle"
                  dominantBaseline="central"
                  y={0.5}
                >
                  {cell.q},{cell.r}
                </text>
              </g>
            );
          })}

          <g className="om-hex-grid-lines" aria-hidden>
            {gridEdges.map((edge) => (
              <line
                key={`${edge.x1},${edge.y1},${edge.x2},${edge.y2}`}
                className="om-hex-grid-line"
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
              />
            ))}
          </g>

          {cellFills && !editMode && (
            <HexBuildingComplexLinks
              cellFills={cellFills}
              hexSize={hexSize}
              orientation={orientation}
            />
          )}

          {visibleCells.map((cell) => {
            const building = activeIds.has(cell.id)
              ? cellFills?.[cell.id]
              : undefined;
            if (!building) return null;
            const { x, y } = hexToPixel(cell, hexSize, orientation);
            return (
              <HexBuildingTile
                key={`logo-${cell.id}`}
                cell={cell}
                x={x}
                y={y}
                hexSize={hexSize}
                orientation={orientation}
                building={building}
                isSelected={selectedId === cell.id}
                isCenter={cell.q === 0 && cell.r === 0}
                layer="logo"
                onSelect={() => setSelectedId(cell.id)}
                onActivate={() => onHexClick?.(cell, true)}
              />
            );
          })}

          {/* Rovers — au-dessus des bâtiments / grille */}
          {!editMode &&
            rovers.map((rover) => {
              const id = hexId(rover);
              if (!activeIds.has(id)) return null;
              const { x, y } = hexToPixel(rover, hexSize, orientation);
              const player = getPlayer(rover.playerIndex);
              const iconSize = hexSize * 1.15;
              return (
                <g
                  key={`rover-p${rover.playerIndex}`}
                  className="om-hex-rover"
                  transform={`translate(${x}, ${y})`}
                  style={{ color: player.color }}
                  role="img"
                  aria-label={`Rover ${player.name} — ${rover.q},${rover.r}`}
                >
                  <circle
                    className="om-hex-rover-pad"
                    r={hexSize * 0.62}
                    fill={player.color}
                    opacity={0.22}
                  />
                  <g
                    className="om-hex-rover-icon"
                    transform={`translate(${-iconSize / 2}, ${-iconSize / 2})`}
                  >
                    <ResourceIcon
                      kind="rover"
                      size={iconSize}
                      title={`Rover ${player.name}`}
                      showTooltip={false}
                    />
                  </g>
                </g>
              );
            })}

          {/* Cibles de déplacement — au-dessus pour rester cliquables */}
          {!editMode &&
            moveTargetIds &&
            [...moveTargetIds].map((id) => {
              const cell = visibleCells.find((c) => c.id === id);
              if (!cell) return null;
              const { x, y } = hexToPixel(cell, hexSize, orientation);
              return (
                <g
                  key={`move-${id}`}
                  className="om-hex is-rover-move"
                  transform={`translate(${x}, ${y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Déplacer le rover vers ${cell.q},${cell.r}`}
                  onClick={() => onHexClick?.(cell, true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onHexClick?.(cell, true);
                    }
                  }}
                >
                  <polygon
                    className="om-hex-rover-move-hit"
                    points={hexPolygonPoints(0, 0, hexSize, orientation)}
                    fill="transparent"
                  />
                  <polygon
                    className="om-hex-rover-move-ring"
                    points={hexPolygonPoints(0, 0, hexSize * 0.88, orientation)}
                    fill="none"
                  />
                </g>
              );
            })}
        </svg>
      </div>
    </div>
  );
}
