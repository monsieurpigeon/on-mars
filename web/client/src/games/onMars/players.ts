/** Palette joueurs — contraste fort sur fond sombre Mars. */
export const PLAYER_COLORS = {
  aqua: {
    key: "aqua",
    label: "Aqua",
    /** Accent / tokens */
    color: "#00E5E0",
    /** Texte sur fond accent */
    ink: "#062628",
    /** Fond doux (badges, highlights) */
    soft: "rgba(0, 229, 224, 0.18)",
  },
  purple: {
    key: "purple",
    label: "Purple",
    color: "#C45CFF",
    ink: "#FFFFFF",
    soft: "rgba(196, 92, 255, 0.2)",
  },
  lime: {
    key: "lime",
    label: "Lime",
    color: "#D4FF3A",
    ink: "#1A2200",
    soft: "rgba(212, 255, 58, 0.16)",
  },
  green: {
    key: "green",
    label: "Green",
    /** Émeraude plus foncé que lime pour rester distinct */
    color: "#1DBF6A",
    ink: "#FFFFFF",
    soft: "rgba(29, 191, 106, 0.18)",
  },
} as const;

export type PlayerColorKey = keyof typeof PLAYER_COLORS;

export type PlayerSlot = {
  index: number;
  name: string;
  colorKey: PlayerColorKey;
  color: string;
  ink: string;
  soft: string;
};

export const PLAYERS: PlayerSlot[] = (
  ["aqua", "purple", "lime", "green"] as const
).map((colorKey, index) => {
  const swatch = PLAYER_COLORS[colorKey];
  return {
    index,
    name: `Joueur ${index + 1}`,
    colorKey,
    color: swatch.color,
    ink: swatch.ink,
    soft: swatch.soft,
  };
});

export function getPlayer(index: number): PlayerSlot {
  return PLAYERS[Math.min(Math.max(index, 0), PLAYERS.length - 1)]!;
}
