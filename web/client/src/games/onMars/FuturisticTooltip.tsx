import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import "./futuristicTooltip.css";

export type TooltipSide = "top" | "right" | "bottom" | "left";

type Props = {
  content: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  className?: string;
};

type Coords = {
  top: number;
  left: number;
};

const GAP = 10;

function placeTooltip(
  trigger: DOMRect,
  tip: DOMRect,
  side: TooltipSide,
): Coords {
  switch (side) {
    case "right":
      return {
        top: trigger.top + trigger.height / 2 - tip.height / 2,
        left: trigger.right + GAP,
      };
    case "top":
      return {
        top: trigger.top - tip.height - GAP,
        left: trigger.left + trigger.width / 2 - tip.width / 2,
      };
    case "bottom":
      return {
        top: trigger.bottom + GAP,
        left: trigger.left + trigger.width / 2 - tip.width / 2,
      };
    case "left":
    default:
      return {
        top: trigger.top + trigger.height / 2 - tip.height / 2,
        left: trigger.left - tip.width - GAP,
      };
  }
}

/** Tooltip HUD réutilisable — toujours ce composant pour le texte au hover. */
export function FuturisticTooltip({
  content,
  children,
  side = "left",
  className,
}: Props) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [coords, setCoords] = useState<Coords>({ top: 0, left: 0 });
  const [accent, setAccent] = useState("");
  const tooltipId = useId();

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const bubble = bubbleRef.current;
    if (!trigger || !bubble) return;

    const next = placeTooltip(
      trigger.getBoundingClientRect(),
      bubble.getBoundingClientRect(),
      side,
    );
    setCoords(next);
    setAccent(getComputedStyle(trigger).getPropertyValue("--view-player").trim());
    setReady(true);
  }, [side]);

  useLayoutEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    updatePosition();
  }, [open, content, side, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => updatePosition();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open, updatePosition]);

  if (content == null || content === "") {
    return <>{children}</>;
  }

  const bubbleStyle = {
    top: coords.top,
    left: coords.left,
    ...(accent ? { "--view-player": accent } : {}),
  } as CSSProperties;

  return (
    <span
      ref={triggerRef}
      className={["om-tooltip", className].filter(Boolean).join(" ")}
      data-side={side}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? tooltipId : undefined}
    >
      {children}
      {open &&
        createPortal(
          <span
            ref={bubbleRef}
            id={tooltipId}
            className={`om-tooltip-bubble${ready ? " is-ready" : ""}`}
            data-side={side}
            role="tooltip"
            style={bubbleStyle}
          >
            <span className="om-tooltip-frame" aria-hidden />
            <span className="om-tooltip-text">{content}</span>
          </span>,
          document.body,
        )}
    </span>
  );
}
