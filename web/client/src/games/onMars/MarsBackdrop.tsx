/** Fond Mars (espace + limbe courbé) — calque sous la zone de jeu. */
export function MarsBackdrop() {
  return (
    <div className="om-mars-backdrop" aria-hidden>
      <div className="om-hex-mars-space" />
      <div className="om-hex-mars-planet">
        <div className="om-hex-mars-terrain" />
        <div className="om-hex-mars-craters" />
        <div className="om-hex-mars-shade" />
      </div>
      <div className="om-hex-mars-atmosphere" />
    </div>
  );
}
