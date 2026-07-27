import { ActionRoundButton } from "./ActionRoundButton";

type Props = {
  label?: string;
  description?: string;
  selected?: boolean;
  onClick?: () => void;
};

/**
 * Module Capsule — libellé + rond d'action.
 */
export function OrbitCapsuleModule({
  label = "Capsule",
  description = "Capsule d'atterrissage",
  selected = false,
  onClick,
}: Props) {
  return (
    <div
      className={`om-orbit-capsule ${selected ? "is-selected" : ""}`}
      aria-label={description}
    >
      <div className="om-action-head">
        <span className="om-orbit-capsule-label">{label}</span>
        <ActionRoundButton
          label={description}
          tone="orbit"
          selected={selected}
          onClick={onClick}
        />
      </div>
    </div>
  );
}
