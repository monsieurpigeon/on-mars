import { useId, useMemo } from "react";
import {
  hexPolygonPoints,
  hexToPixel,
  hexViewBoxForCells,
} from "./hexGrid";
import { TECH_HEX_CELLS } from "./techMap";

const ORIENTATION = "flat" as const;
const HEX_SIZE = 18;
/** Aplatissement vertical des hexes (1 = régulier). */
const Y_SCALE = 0.82;

/** Petite grille Tech — colony-base-centered (flat), hexes un peu aplatis. */
export function TechHexGrid() {
  const uid = useId().replace(/:/g, "");
  const fillId = `om-tech-hex-fill-${uid}`;

  const view = useMemo(
    () => hexViewBoxForCells(TECH_HEX_CELLS, HEX_SIZE, ORIENTATION, 4, Y_SCALE),
    [],
  );

  return (
    <div className="om-tech-hex-wrap">
      <svg
        className="om-tech-hex-svg"
        viewBox={`${view.minX} ${view.minY} ${view.width} ${view.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="grid"
        aria-label="Grille hexagonale Tech"
      >
        <defs>
          <radialGradient id={fillId} cx="35%" cy="30%" r="75%">
            <stop className="om-tech-hex-stop-0" offset="0%" />
            <stop offset="55%" stopColor="rgba(42, 22, 16, 0.88)" />
            <stop offset="100%" stopColor="rgba(12, 7, 5, 0.95)" />
          </radialGradient>
        </defs>

        {TECH_HEX_CELLS.map((cell) => {
          const { x, y } = hexToPixel(cell, HEX_SIZE, ORIENTATION, Y_SCALE);
          return (
            <g
              key={cell.id}
              className="om-tech-hex"
              transform={`translate(${x}, ${y})`}
              role="gridcell"
              aria-label={`Tech ${cell.q}, ${cell.r}`}
            >
              <polygon
                className="om-tech-hex-shape"
                points={hexPolygonPoints(0, 0, HEX_SIZE - 1.2, ORIENTATION, Y_SCALE)}
                fill={`url(#${fillId})`}
              />
              <text
                className="om-tech-hex-coord"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {cell.q},{cell.r}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
