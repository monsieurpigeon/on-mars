import { useId, useMemo } from "react";
import type { ColonyBuildingKind } from "./colonyBuildings";
import {
  hexDistance,
  hexToPixel,
  parseHexId,
  type HexOrientation,
} from "./hexGrid";
import type { HexBuildingFill } from "./HexBuildingTile";

export type BuildingComplexLink = {
  id: string;
  kind: ColonyBuildingKind;
  /** Couleur au centre de la capsule (opaque). */
  color: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

/** Identité de complexe : abris différenciés par couleur joueur. */
function complexIdentity(b: HexBuildingFill): string {
  if (b.kind === "shelter") {
    return `shelter:${b.playerIndex ?? 0}`;
  }
  return b.kind;
}

function parseHexColor(
  fill: string,
): { r: number; g: number; b: number } | null {
  const hex = fill.trim();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return null;
  const full =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
  return {
    r: parseInt(full.slice(1, 3), 16),
    g: parseInt(full.slice(3, 5), 16),
    b: parseInt(full.slice(5, 7), 16),
  };
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mixRgb(
  from: { r: number; g: number; b: number },
  to: { r: number; g: number; b: number },
  t: number,
): { r: number; g: number; b: number } {
  return {
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
  };
}

/**
 * Couleur centrale de capsule : même teinte que le fill, contraste renforcé.
 */
function capsuleColor(fill: string, ink?: string): string {
  const rgb = parseHexColor(fill);
  if (!rgb) return fill;
  const luma = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;

  if (luma >= 150) {
    const inkRgb = ink ? parseHexColor(ink) : null;
    const inkLuma = inkRgb
      ? (inkRgb.r * 299 + inkRgb.g * 587 + inkRgb.b * 114) / 1000
      : 999;
    const target =
      inkRgb && inkLuma < luma - 40 ? inkRgb : { r: 18, g: 14, b: 12 };
    const t = Math.min(0.42, Math.max(0.28, (luma - 120) / 255 + 0.28));
    return toHex(mixRgb(rgb, target, t));
  }

  const inkRgb = ink ? parseHexColor(ink) : null;
  const inkLuma = inkRgb
    ? (inkRgb.r * 299 + inkRgb.g * 587 + inkRgb.b * 114) / 1000
    : -1;
  const target =
    inkRgb && inkLuma > luma + 40 ? inkRgb : { r: 255, g: 255, b: 255 };
  const t = Math.min(0.44, Math.max(0.3, (160 - luma) / 255 + 0.3));
  return toHex(mixRgb(rgb, target, t));
}

/** Paires de bâtiments identiques et adjacents (complexes). */
export function findBuildingComplexLinks(
  cellFills: Record<string, HexBuildingFill>,
  hexSize: number,
  orientation: HexOrientation,
): BuildingComplexLink[] {
  const entries = Object.entries(cellFills);
  const links: BuildingComplexLink[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < entries.length; i++) {
    const [idA, a] = entries[i]!;
    if (!a.kind) continue;
    const identityA = complexIdentity(a);
    const coordA = parseHexId(idA);

    for (let j = i + 1; j < entries.length; j++) {
      const [idB, b] = entries[j]!;
      if (complexIdentity(b) !== identityA) continue;
      const coordB = parseHexId(idB);
      if (hexDistance(coordA, coordB) !== 1) continue;

      const pairKey = [idA, idB].sort().join("|");
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const pA = hexToPixel(coordA, hexSize, orientation);
      const pB = hexToPixel(coordB, hexSize, orientation);
      links.push({
        id: `complex-${pairKey}`,
        kind: a.kind,
        color: capsuleColor(a.fill, a.ink),
        x1: pA.x,
        y1: pA.y,
        x2: pB.x,
        y2: pB.y,
      });
    }
  }

  return links;
}

type Props = {
  cellFills: Record<string, HexBuildingFill>;
  hexSize: number;
  orientation: HexOrientation;
};

/**
 * Capsules entre bâtiments identiques adjacents.
 * Dégradé longitudinal : transparent → opaque → transparent (sur la longueur).
 */
export function HexBuildingComplexLinks({
  cellFills,
  hexSize,
  orientation,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const links = useMemo(
    () => findBuildingComplexLinks(cellFills, hexSize, orientation),
    [cellFills, hexSize, orientation],
  );

  if (links.length === 0) return null;

  const capsuleWidth = hexSize * 0.85 + 2;

  return (
    <g className="om-hex-building-complexes" aria-hidden>
      {links.map((link) => {
        const dx = link.x2 - link.x1;
        const dy = link.y2 - link.y1;
        const length = Math.hypot(dx, dy) || 1;
        const midX = (link.x1 + link.x2) / 2;
        const midY = (link.y1 + link.y2) / 2;
        const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
        const gradId = `${uid}-grad-${link.id}`;
        const radius = capsuleWidth / 2;

        return (
          <g
            key={link.id}
            className={`om-hex-building-complex om-hex-building-complex--${link.kind}`}
            transform={`translate(${midX}, ${midY}) rotate(${angleDeg})`}
          >
            <defs>
              <linearGradient
                id={gradId}
                x1="0"
                y1="0"
                x2="1"
                y2="0"
                gradientUnits="objectBoundingBox"
              >
                <stop offset="0%" stopColor={link.color} stopOpacity={0} />
                <stop offset="50%" stopColor={link.color} stopOpacity={1} />
                <stop offset="100%" stopColor={link.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <rect
              className="om-hex-building-complex-link"
              x={-length / 2}
              y={-radius}
              width={length}
              height={capsuleWidth}
              rx={radius}
              ry={radius}
              fill={`url(#${gradId})`}
            />
          </g>
        );
      })}
    </g>
  );
}
