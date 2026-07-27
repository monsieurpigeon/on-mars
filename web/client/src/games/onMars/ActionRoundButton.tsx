type Props = {
  /** Libellé pour accessibilité. */
  label: string;
  /** Teinte plateau. */
  tone?: "colony" | "orbit";
  /** Action sélectionnée. */
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

/**
 * Rond d’action — sélectionne / réalise l’action du module.
 */
export function ActionRoundButton({
  label,
  tone = "colony",
  selected = false,
  disabled = false,
  onClick,
}: Props) {
  return (
    <button
      type="button"
      className={[
        "om-action-round",
        `is-${tone}`,
        selected ? "is-selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={label}
      title={label}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="om-action-round-dot" aria-hidden />
    </button>
  );
}
