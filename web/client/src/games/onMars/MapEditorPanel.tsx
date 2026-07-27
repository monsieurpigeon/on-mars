import type { ColonyMap } from "./colonyMap";
import {
  downloadMapJson,
  mapFromDisk,
  mapToJson,
  normalizeMap,
} from "./colonyMap";
import type { HexOrientation } from "./hexGrid";

type Props = {
  map: ColonyMap;
  onChange: (map: ColonyMap) => void;
  onSaveBase: (map: ColonyMap) => void;
  onResetBundled: () => void;
};

export function MapEditorPanel({
  map,
  onChange,
  onSaveBase,
  onResetBundled,
}: Props) {
  function setOrientation(orientation: HexOrientation) {
    onChange({ ...map, orientation });
  }

  async function copyJson() {
    await navigator.clipboard.writeText(mapToJson(map));
  }

  function importJson() {
    const raw = window.prompt("Colle le JSON de la carte :");
    if (!raw) return;
    try {
      onChange(normalizeMap(JSON.parse(raw)));
    } catch {
      window.alert("JSON invalide.");
    }
  }

  return (
    <div className="map-editor-panel">
      <p className="muted map-editor-hint">
        Canvas large (rayon 8). Clique les hexes pour activer/désactiver, puis
        enregistre la carte de base.
      </p>

      <div className="map-editor-row">
        <span className="map-editor-label">Orientation</span>
        <div className="map-editor-seg">
          <button
            type="button"
            className={`btn ${map.orientation === "flat" ? "primary" : ""}`}
            onClick={() => setOrientation("flat")}
          >
            Flat
          </button>
          <button
            type="button"
            className={`btn ${map.orientation === "pointy" ? "primary" : ""}`}
            onClick={() => setOrientation("pointy")}
          >
            Pointy
          </button>
        </div>
      </div>

      <div className="map-editor-row">
        <span className="map-editor-label">Forme</span>
        <div className="map-editor-seg">
          <button
            type="button"
            className="btn"
            onClick={() => onChange(mapFromDisk(3, map.orientation))}
          >
            Disque r3
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => onChange(mapFromDisk(4, map.orientation))}
          >
            Disque r4
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              onChange({ ...map, cells: [], name: map.name || "colony" })
            }
          >
            Vider
          </button>
        </div>
      </div>

      <p className="om-count map-editor-stats">{map.cells.length} hexes</p>

      <div className="map-editor-actions">
        <button
          type="button"
          className="btn primary"
          onClick={() => onSaveBase(map)}
        >
          Enregistrer carte de base
        </button>
        <button type="button" className="btn" onClick={() => downloadMapJson(map)}>
          Télécharger JSON
        </button>
        <button type="button" className="btn" onClick={() => void copyJson()}>
          Copier JSON
        </button>
        <button type="button" className="btn" onClick={importJson}>
          Importer JSON
        </button>
        <button type="button" className="btn" onClick={onResetBundled}>
          Reset fichier
        </button>
      </div>
    </div>
  );
}
