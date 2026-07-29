import type { SVGProps } from "react";

type Props = {
  size?: number | string;
  title?: string;
} & Omit<SVGProps<SVGSVGElement>, "children">;

/** Icône Saturne (planète + 2 anneaux) — symbole de point de victoire. */
export function SaturnIcon({
  size = "1em",
  title = "Point de victoire",
  className,
  ...rest
}: Props) {
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
      aria-label={title}
      className={["om-saturn-icon", className].filter(Boolean).join(" ")}
      {...rest}
    >
      {/* Anneau extérieur */}
      <ellipse cx="12" cy="12" rx="10.5" ry="4.5" />
      {/* Corps planète */}
      <circle cx="12" cy="12" r="5" />
      {/* Anneau intérieur */}
      <ellipse cx="12" cy="12" rx="7.2" ry="3" />
    </svg>
  );
}
