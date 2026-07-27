import type { SVGProps } from "react";

type Props = {
  size?: number | string;
  title?: string;
} & Omit<SVGProps<SVGSVGElement>, "children">;

/** Icône fusée — à réutiliser partout (blocage de cases, UI, etc.). */
export function RocketIcon({
  size = "100%",
  title = "Fusée",
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
      className={["om-rocket-icon", className].filter(Boolean).join(" ")}
      {...rest}
    >
      {/* Corps */}
      <path d="M12 2.8c2.4 2.2 3.6 5.4 3.6 9.2 0 2.2-.4 4-.9 5.5H9.3c-.5-1.5-.9-3.3-.9-5.5 0-3.8 1.2-7 3.6-9.2Z" />
      {/* Hublot */}
      <circle cx="12" cy="10.2" r="1.6" />
      {/* Ailerons */}
      <path d="M9.2 14.2 6.4 17.8M14.8 14.2l2.8 3.6" />
      {/* Flamme */}
      <path d="M10.4 17.5c.4 1.6 1 2.8 1.6 3.7.6-.9 1.2-2.1 1.6-3.7" />
    </svg>
  );
}
