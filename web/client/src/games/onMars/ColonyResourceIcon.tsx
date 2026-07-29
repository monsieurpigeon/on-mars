import type { ReactNode, SVGProps } from "react";
import {
  COLONY_RESOURCE_LABELS,
  type ColonyResourceKind,
} from "./colonyResources";

type Props = {
  kind: ColonyResourceKind;
  size?: number | string;
  title?: string;
} & Omit<SVGProps<SVGSVGElement>, "children">;

/** Les 4 ressources à tokens LSS (hors minerai). */
export const LSS_TOKEN_RESOURCES = [
  "energie",
  "eau",
  "plante",
  "oxygene",
] as const;

export type LssTokenResource = (typeof LSS_TOKEN_RESOURCES)[number];

export function isLssTokenResource(kind: ColonyResourceKind): kind is LssTokenResource {
  return (LSS_TOKEN_RESOURCES as readonly string[]).includes(kind);
}

function EnergieGlyph() {
  /* Éclair */
  return (
    <path
      fill="currentColor"
      stroke="none"
      d="M13.2 2.5 6.8 13.2h4.2l-1.6 8.3 7.8-12.2h-4.4L13.2 2.5Z"
    />
  );
}

function EauGlyph() {
  /* Goutte */
  return (
    <path
      fill="currentColor"
      stroke="none"
      d="M12 3.2c0 0-5.8 6.4-5.8 10.2a5.8 5.8 0 1 0 11.6 0C17.8 9.6 12 3.2 12 3.2Z"
    />
  );
}

function PlanteGlyph() {
  /* Feuille */
  return (
    <g fill="currentColor" stroke="none">
      <path d="M12 20.2c0 0-6.2-3.4-6.2-8.4S12 3.2 12 3.2s6.2 3.6 6.2 8.6S12 20.2 12 20.2Z" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        d="M12 20.2V10.5"
      />
    </g>
  );
}

function OxygeneGlyph() {
  /* O₂ stylisé — deux bulles */
  return (
    <g fill="none" stroke="currentColor" strokeWidth={1.7}>
      <circle cx="9" cy="13" r="4.2" />
      <circle cx="15.2" cy="9.2" r="3.2" />
    </g>
  );
}

function MineraiGlyph() {
  /* Cristal / minerai anguleux */
  return (
    <path
      fill="currentColor"
      stroke="none"
      d="M12 2.8 4.8 9.4l2.4 9.8h9.6l2.4-9.8L12 2.8Zm0 2.4 4.6 4.4-1.4 6.6H8.8L7.4 9.6 12 5.2Z"
    />
  );
}

const GLYPHS: Record<ColonyResourceKind, () => ReactNode> = {
  energie: EnergieGlyph,
  eau: EauGlyph,
  plante: PlanteGlyph,
  oxygene: OxygeneGlyph,
  minerai: MineraiGlyph,
};

/** Icône réutilisable pour une ressource colonie / LSS. */
export function ColonyResourceIcon({
  kind,
  size = "100%",
  title,
  className,
  ...rest
}: Props) {
  const Glyph = GLYPHS[kind];
  const label = title ?? COLONY_RESOURCE_LABELS[kind];

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={label}
      className={[
        "om-colony-resource-icon",
        `om-colony-resource-icon--${kind}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      <Glyph />
    </svg>
  );
}
