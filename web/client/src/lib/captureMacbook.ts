import { toCanvas } from "html-to-image";

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

/**
 * Capture exacte du cadre MacBook 1280×800 (1 CSS px = 1 px image).
 * Verrouille temporairement le nœud à la taille cible avant export.
 */
export async function captureMacbookPng(node: HTMLElement): Promise<string> {
  const capturingClass = "is-capturing-macbook";
  node.classList.add(capturingClass);

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    await waitFrames(2);

    const canvas = await toCanvas(node, {
      cacheBust: true,
      pixelRatio: 1,
      width: MACBOOK_W,
      height: MACBOOK_H,
      canvasWidth: MACBOOK_W,
      canvasHeight: MACBOOK_H,
      // Pas de `style` override : le layout vient du vrai DOM verrouillé
      filter: (el) => {
        // Exclure les tooltips portés sur body (déjà hors nœud)
        if (el instanceof HTMLElement && el.classList.contains("om-tooltip-bubble")) {
          return false;
        }
        return true;
      },
    });

    // Recadrage strict si le canvas déborde d’1 px
    if (canvas.width !== MACBOOK_W || canvas.height !== MACBOOK_H) {
      const exact = document.createElement("canvas");
      exact.width = MACBOOK_W;
      exact.height = MACBOOK_H;
      const ctx = exact.getContext("2d");
      if (!ctx) return canvas.toDataURL("image/png");
      ctx.drawImage(canvas, 0, 0, MACBOOK_W, MACBOOK_H);
      return exact.toDataURL("image/png");
    }

    return canvas.toDataURL("image/png");
  } finally {
    node.classList.remove(capturingClass);
  }
}
