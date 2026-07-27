export type OrbitModuleId =
  | "landing_pod"
  | "obtain_blueprint"
  | "learn_tech"
  | "research_develop"
  | "stock";

export type OrbitModule = {
  id: OrbitModuleId;
  /** Libellé court affiché dans la case. */
  short: string;
  /** Libellé complet (tooltip). */
  label: string;
};

/** Modules Orbite — ordre d’affichage (haut → bas). */
export const ORBIT_MODULES: OrbitModule[] = [
  {
    id: "landing_pod",
    short: "Capsule",
    label: "Capsule d'atterrissage",
  },
  {
    id: "obtain_blueprint",
    short: "Plan",
    label: "Obtenir un plan",
  },
  {
    id: "learn_tech",
    short: "Techno",
    label: "Apprendre une nouvelle techno",
  },
  {
    id: "research_develop",
    short: "R&D",
    label: "Recherche et développement",
  },
  {
    id: "stock",
    short: "Stock",
    label: "Stock",
  },
];
