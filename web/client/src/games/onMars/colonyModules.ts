export type ColonyModuleId =
  | "control_center"
  | "construct_building"
  | "upgrade_building"
  | "welcome_ship"
  | "hire_scientist";

export type ColonyModule = {
  id: ColonyModuleId;
  short: string;
  label: string;
};

/** Modules Colonie — ordre d’affichage (haut → bas). */
export const COLONY_MODULES: ColonyModule[] = [
  {
    id: "construct_building",
    short: "Construire",
    label: "Construire un bâtiment",
  },
  {
    id: "upgrade_building",
    short: "Améliorer",
    label: "Améliorer un bâtiment",
  },
  {
    id: "hire_scientist",
    short: "Science",
    label: "Engager un scientifique",
  },
  {
    id: "control_center",
    short: "Contrôle",
    label: "Centre de contrôle",
  },
  {
    id: "welcome_ship",
    short: "Vaisseau",
    label: "Accueillir un vaisseau",
  },
];
