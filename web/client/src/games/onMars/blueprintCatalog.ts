/**
 * Catalogue des plans — source : data/blueprints.csv (miroir serveur).
 * classe CSV = niveau de bâtiment (1 ou 3) ; ids 1–12 = offre bleue, 13–24 = offre rouge.
 */

export const BLUEPRINT_RESOURCES = [
  "minerai",
  "energie",
  "eau",
  "plante",
  "oxygene",
  "abri",
] as const;

export type BlueprintResource = (typeof BLUEPRINT_RESOURCES)[number];

export type BlueprintDef = {
  id: number;
  /** Niveau bâtiment (1 ou 3 d'après le CSV). */
  level: number;
  name: string;
  resource: BlueprintResource;
};

const RAW: BlueprintDef[] = [
  { id: 1, level: 1, name: "construction yard", resource: "minerai" },
  { id: 2, level: 1, name: "metal deposit", resource: "minerai" },
  { id: 3, level: 1, name: "automated production", resource: "energie" },
  { id: 4, level: 1, name: "wind turbines", resource: "energie" },
  { id: 5, level: 1, name: "moisture vaporator", resource: "eau" },
  { id: 6, level: 1, name: "private ship", resource: "eau" },
  { id: 7, level: 1, name: "biomarket", resource: "plante" },
  { id: 8, level: 1, name: "hydroponic farm", resource: "plante" },
  { id: 9, level: 1, name: "concentrator", resource: "oxygene" },
  { id: 10, level: 1, name: "oxygen tank", resource: "oxygene" },
  { id: 11, level: 1, name: "casino", resource: "abri" },
  { id: 12, level: 1, name: "gym", resource: "abri" },
  { id: 13, level: 3, name: "biolab", resource: "minerai" },
  { id: 14, level: 3, name: "mineral mine", resource: "minerai" },
  { id: 15, level: 3, name: "builder drone ai600", resource: "energie" },
  { id: 16, level: 3, name: "radar", resource: "energie" },
  { id: 17, level: 3, name: "aqueduct", resource: "eau" },
  { id: 18, level: 3, name: "research lab", resource: "eau" },
  { id: 19, level: 3, name: "eco resort", resource: "plante" },
  { id: 20, level: 3, name: "trade market", resource: "plante" },
  { id: 21, level: 3, name: "aerial elevator", resource: "oxygene" },
  { id: 22, level: 3, name: "recycling bots", resource: "oxygene" },
  { id: 23, level: 3, name: "command center", resource: "abri" },
  { id: 24, level: 3, name: "library", resource: "abri" },
];

export const BLUEPRINT_CATALOG: readonly BlueprintDef[] = RAW;

const BY_ID = new Map(RAW.map((d) => [d.id, d]));

export function getBlueprintDef(id: number): BlueprintDef | undefined {
  return BY_ID.get(id);
}

export function blueprintResourceClass(resource: BlueprintResource): string {
  return `om-res--${resource}`;
}
