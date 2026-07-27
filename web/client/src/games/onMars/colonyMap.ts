import baseMapJson from "./data/baseMap.json";
import {
  buildHexDisk,
  hexId,
  type HexCoord,
  type HexOrientation,
} from "./hexGrid";

export const COLONY_MAP_STORAGE_KEY = "on-mars.colony-base-map";

export type ColonyMap = {
  version: 1;
  name: string;
  orientation: HexOrientation;
  cells: HexCoord[];
};

export function normalizeMap(raw: unknown): ColonyMap {
  const data = raw as Partial<ColonyMap>;
  const orientation: HexOrientation =
    data.orientation === "pointy" ? "pointy" : "flat";
  const cells = Array.isArray(data.cells)
    ? data.cells
        .filter(
          (c): c is HexCoord =>
            !!c &&
            typeof c === "object" &&
            Number.isFinite((c as HexCoord).q) &&
            Number.isFinite((c as HexCoord).r),
        )
        .map((c) => ({ q: c.q, r: c.r }))
    : [];

  // Déduplique
  const seen = new Set<string>();
  const unique: HexCoord[] = [];
  for (const c of cells) {
    const id = hexId(c);
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(c);
  }

  return {
    version: 1,
    name: typeof data.name === "string" ? data.name : "colony",
    orientation,
    cells: unique,
  };
}

export function createEmptyMap(
  orientation: HexOrientation = "flat",
  name = "colony",
): ColonyMap {
  return { version: 1, name, orientation, cells: [] };
}

export function mapFromDisk(
  radius: number,
  orientation: HexOrientation = "flat",
): ColonyMap {
  return {
    version: 1,
    name: `disk-r${radius}`,
    orientation,
    cells: buildHexDisk(radius).map(({ q, r }) => ({ q, r })),
  };
}

export function getBundledBaseMap(): ColonyMap {
  return normalizeMap(baseMapJson);
}

export function loadBaseMap(): ColonyMap {
  const bundled = getBundledBaseMap();
  try {
    const raw = localStorage.getItem(COLONY_MAP_STORAGE_KEY);
    if (raw) {
      const stored = normalizeMap(JSON.parse(raw));
      // Ignore un ancien cache si la carte bundlée a changé de nom/version logique
      if (stored.name === bundled.name) return stored;
    }
  } catch {
    // ignore
  }
  return bundled;
}

export function saveBaseMap(map: ColonyMap): ColonyMap {
  const normalized = normalizeMap(map);
  localStorage.setItem(COLONY_MAP_STORAGE_KEY, JSON.stringify(normalized, null, 2));
  return normalized;
}

export function mapToJson(map: ColonyMap): string {
  return JSON.stringify(normalizeMap(map), null, 2);
}

export function downloadMapJson(map: ColonyMap, filename = "baseMap.json") {
  const blob = new Blob([mapToJson(map)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toggleCell(map: ColonyMap, coord: HexCoord): ColonyMap {
  const id = hexId(coord);
  const has = map.cells.some((c) => hexId(c) === id);
  return {
    ...map,
    cells: has
      ? map.cells.filter((c) => hexId(c) !== id)
      : [...map.cells, { q: coord.q, r: coord.r }],
  };
}

export function setCellActive(
  map: ColonyMap,
  coord: HexCoord,
  active: boolean,
): ColonyMap {
  const id = hexId(coord);
  const has = map.cells.some((c) => hexId(c) === id);
  if (active && !has) {
    return { ...map, cells: [...map.cells, { q: coord.q, r: coord.r }] };
  }
  if (!active && has) {
    return { ...map, cells: map.cells.filter((c) => hexId(c) !== id) };
  }
  return map;
}
