import {
  COLONY_RESOURCE_LABELS,
  colonyResourceClass,
  type ColonyResourceKind,
} from "./colonyResources";
import { ColonyResourceIcon } from "./ColonyResourceIcon";

type Props = {
  kind: ColonyResourceKind;
  className?: string;
  /** Taille de l’icône (défaut : remplit le token). */
  iconSize?: number | string;
  disabled?: boolean;
  onClick?: () => void;
};

/**
 * Token ressource LSS — carré couleur canonique + icône réutilisable.
 * Cliquable si `onClick` est fourni.
 */
export function ColonyResourceToken({
  kind,
  className,
  iconSize = "70%",
  disabled = false,
  onClick,
}: Props) {
  const label = COLONY_RESOURCE_LABELS[kind];
  const classes = [
    "om-colony-resource-token",
    colonyResourceClass(kind),
    onClick ? "is-interactive" : "",
    disabled ? "is-disabled" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (onClick) {
    return (
      <button
        type="button"
        className={classes}
        title={label}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
      >
        <ColonyResourceIcon kind={kind} size={iconSize} title={label} />
      </button>
    );
  }

  return (
    <div className={classes} title={label} aria-label={label}>
      <ColonyResourceIcon kind={kind} size={iconSize} title={label} />
    </div>
  );
}
