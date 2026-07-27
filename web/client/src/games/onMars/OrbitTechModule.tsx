import { ActionRoundButton } from "./ActionRoundButton";

type Props = {
  label?: string;
  description?: string;
  selected?: boolean;
  onClick?: () => void;
};

const ROW_COUNTS = [3, 3, 2] as const;

/**
 * Module Techno — hexagones flat en 3 / 3 / 2, avec espace entre eux.
 */
export function OrbitTechModule({
  label = "Techno",
  description = "Apprendre une nouvelle techno",
  selected = false,
  onClick,
}: Props) {
  return (
    <div
      className={`om-orbit-tech ${selected ? "is-selected" : ""}`}
      aria-label={description}
    >
      <div className="om-action-head">
        <span className="om-orbit-tech-label">{label}</span>
        <ActionRoundButton
          label={description}
          tone="orbit"
          selected={selected}
          onClick={onClick}
        />
      </div>
      <div className="om-orbit-tech-grid" aria-hidden>
        {ROW_COUNTS.map((count, row) => (
          <ul key={row} className="om-orbit-tech-row">
            {Array.from({ length: count }, (_, col) => (
              <li key={col} className="om-orbit-tech-hex" />
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
