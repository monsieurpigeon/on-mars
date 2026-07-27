import { ActionRoundButton } from "./ActionRoundButton";

type Props = {
  /** Libellé court affiché. */
  label: string;
  /** Description longue (tooltip / accessibilité). */
  description?: string;
  selected?: boolean;
  onClick?: () => void;
};

/**
 * Module d'action à un seul rond
 * (Contrôle, Vaisseau, Capsule, …).
 */
export function ColonyRoundSlot({
  label,
  description,
  selected = false,
  onClick,
}: Props) {
  const title = description ?? label;

  return (
    <div
      className={`om-colony-round ${selected ? "is-selected" : ""}`}
      aria-label={title}
    >
      <div className="om-action-head">
        <span className="om-colony-round-label">{label}</span>
        <ActionRoundButton
          label={title}
          tone="colony"
          selected={selected}
          onClick={onClick}
        />
      </div>
    </div>
  );
}
