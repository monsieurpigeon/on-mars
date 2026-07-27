import type { SVGProps } from "react";
import type { BoardZone } from "./gameState";
import { BOARD_ZONE_LABELS } from "./gameState";

type Props = {
  zone: BoardZone;
  size?: number | string;
  title?: string;
} & Omit<SVGProps<SVGSVGElement>, "children">;

function OrbitGlyph() {
  return (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <ellipse cx="12" cy="12" rx="9" ry="4.2" transform="rotate(-25 12 12)" />
      <circle cx="18.5" cy="8.2" r="1.2" />
    </>
  );
}

function ColonyGlyph() {
  return (
    <>
      <path d="M5 18.5h14" />
      <path d="M7 18.5V11l5-5 5 5v7.5" />
      <path d="M10 18.5v-4h4v4" />
      <circle cx="12" cy="4.2" r="1" />
    </>
  );
}

/** Icône unique pour la zone plateau (orbite / colonie). */
export function ZoneIcon({ zone, size = 16, title, className, ...rest }: Props) {
  const label = title ?? BOARD_ZONE_LABELS[zone];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={label}
      className={["om-zone-icon", `om-zone-icon--${zone}`, className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      <title>{label}</title>
      {zone === "orbit" ? <OrbitGlyph /> : <ColonyGlyph />}
    </svg>
  );
}
