import type { SVGProps } from "react";

type Props = {
  size?: number | string;
  title?: string;
} & Omit<SVGProps<SVGSVGElement>, "children">;

/** Icône cristal — à réutiliser partout. */
export function CrystalIcon({
  size = "100%",
  title = "Cristal",
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
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={title}
      className={["om-crystal-icon", className].filter(Boolean).join(" ")}
      {...rest}
    >
      <path d="M12 2.8 4.6 9.2 12 21.2l7.4-12L12 2.8Z" />
      <path d="M4.6 9.2h14.8M8.2 9.2 12 21.2l3.8-12M12 2.8v6.4" />
    </svg>
  );
}
