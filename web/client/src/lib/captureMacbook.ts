import { snapdom } from "@zumer/snapdom";

export const MACBOOK_W = 1280;
export const MACBOOK_H = 800;

function waitFrames(n = 2): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) => {
      if (left <= 0) resolve();
      else requestAnimationFrame(() => step(left - 1));
    };
    step(n);
  });
}

type Pinned = {
  el: HTMLElement;
  width: string;
  height: string;
  maxWidth: string;
  maxHeight: string;
  attrWidth: string | null;
  attrHeight: string | null;
};

/**
 * Épingle les boîtes layout (px) pour que le clone SVG/foreignObject
 * ne recalcule pas les % / aspect-ratio autrement que l’écran.
 */
function pinLayoutSizes(root: HTMLElement): Pinned[] {
  const pinned: Pinned[] = [];
  const targets = [
    root,
    ...root.querySelectorAll<HTMLElement>(
      [
        ".om-screen",
        ".om-zone-game",
        ".om-game-body",
        ".om-screen-main",
        ".om-common-board",
        ".om-hex-wrap",
        ".om-hex-hud",
        ".om-hex-svg",
        ".om-tech-hex-wrap",
        ".om-tech-hex-svg",
        ".om-personal-layout",
        ".om-panel-tech",
        ".om-panel-tech-col",
        ".om-crystal-stock",
        ".om-panel-shelters",
        ".om-panel-lab",
        ".om-lss-grid",
      ].join(", "),
    ),
  ];

  const seen = new Set<HTMLElement>();
  for (const el of targets) {
    if (seen.has(el)) continue;
    seen.add(el);
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w <= 0 || h <= 0) continue;

    const entry: Pinned = {
      el,
      width: el.style.width,
      height: el.style.height,
      maxWidth: el.style.maxWidth,
      maxHeight: el.style.maxHeight,
      attrWidth: el.getAttribute("width"),
      attrHeight: el.getAttribute("height"),
    };
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.maxWidth = `${w}px`;
    el.style.maxHeight = `${h}px`;
    if (el instanceof SVGSVGElement) {
      el.setAttribute("width", String(w));
      el.setAttribute("height", String(h));
    }
    pinned.push(entry);
  }
  return pinned;
}

function unpinLayoutSizes(pinned: Pinned[]) {
  for (const p of pinned) {
    p.el.style.width = p.width;
    p.el.style.height = p.height;
    p.el.style.maxWidth = p.maxWidth;
    p.el.style.maxHeight = p.maxHeight;
    if (p.el instanceof SVGSVGElement) {
      if (p.attrWidth == null) p.el.removeAttribute("width");
      else p.el.setAttribute("width", p.attrWidth);
      if (p.attrHeight == null) p.el.removeAttribute("height");
      else p.el.setAttribute("height", p.attrHeight);
    }
  }
}

function canvasToPngDataUrl(canvas: HTMLCanvasElement): string {
  if (canvas.width === MACBOOK_W && canvas.height === MACBOOK_H) {
    return canvas.toDataURL("image/png");
  }
  const exact = document.createElement("canvas");
  exact.width = MACBOOK_W;
  exact.height = MACBOOK_H;
  const ctx = exact.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");
  ctx.fillStyle = "#120b08";
  ctx.fillRect(0, 0, MACBOOK_W, MACBOOK_H);
  ctx.drawImage(canvas, 0, 0, MACBOOK_W, MACBOOK_H);
  return exact.toDataURL("image/png");
}

/**
 * Capture exacte 1280×800 via SnapDOM.
 * - Ne mute pas le scale d’aperçu live (évite le reflow / décalage)
 * - outerTransforms:false → ignore le scale CSS du frame
 * - reconcile:true → aligne les boîtes du clone sur le DOM réel
 */
export async function captureMacbookPng(node: HTMLElement): Promise<string> {
  const capturingClass = "is-capturing-macbook";
  node.classList.add(capturingClass);

  let pinned: Pinned[] = [];

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    await waitFrames(2);

    pinned = pinLayoutSizes(node);
    await waitFrames(2);

    const canvas = await snapdom.toCanvas(node, {
      width: MACBOOK_W,
      height: MACBOOK_H,
      dpr: 1,
      scale: 1,
      backgroundColor: "#120b08",
      embedFonts: true,
      /** Ignore le `transform: scale(...)` d’aperçu — capture le layout 1280×800. */
      outerTransforms: false,
      outerShadows: false,
      /** Corrige les dérives de layout texte / flex du clone vs l’écran. */
      reconcile: true,
      fast: false,
      exclude: [".om-tooltip-bubble"],
      filter: (el) => {
        if (
          el instanceof HTMLElement &&
          el.classList.contains("om-tooltip-bubble")
        ) {
          return false;
        }
        return true;
      },
    });

    return canvasToPngDataUrl(canvas);
  } finally {
    unpinLayoutSizes(pinned);
    node.classList.remove(capturingClass);
  }
}
