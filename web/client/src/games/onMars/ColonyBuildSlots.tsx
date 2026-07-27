import { ActionRoundButton } from "./ActionRoundButton";

type Props = {
  /** Libellé court affiché. */
  label: string;
  /** Description longue (tooltip / accessibilité). */
  description?: string;
  /** Teinte plateau — colonie (ember) ou orbite (ox). */
  tone?: "colony" | "orbit";
  selected?: boolean;
  onClick?: () => void;
};

const SLOT_COUNT = 3;

/**
 * Module d'action à 3 carrés horizontaux
 * (Construire / Améliorer, Plan / R&D, …).
 */
export function ColonyBuildSlots({
  label,
  description,
  tone = "colony",
  selected = false,
  onClick,
}: Props) {
  const title = description ?? label;

  return (
    <div
      className={`om-colony-build is-${tone} ${selected ? "is-selected" : ""}`}
      aria-label={title}
    >
      <div className="om-action-head">
        <span className="om-colony-build-label">{label}</span>
        <ActionRoundButton
          label={title}
          tone={tone}
          selected={selected}
          onClick={onClick}
        />
      </div>
      <ul className="om-colony-build-slots" aria-hidden>
        {Array.from({ length: SLOT_COUNT }, (_, index) => (
          <li key={index} className="om-colony-build-slot" />
        ))}
      </ul>
    </div>
  );
}
