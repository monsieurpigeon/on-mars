import { useRef, useState } from "react";
import { captureMacbookPng } from "../lib/captureMacbook";
import {
  getBundledBaseMap,
  loadBaseMap,
  saveBaseMap,
  type ColonyMap,
} from "../games/onMars/colonyMap";
import { MapEditorPanel } from "../games/onMars/MapEditorPanel";
import { OnMarsPage } from "../games/onMars/OnMarsPage";
import {
  reloadOrbitBankOnServer,
  resetTestSessionOnServer,
} from "../games/onMars/testSessionApi";

export function TestPage() {
  const [macbookFrame, setMacbookFrame] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [editMap, setEditMap] = useState(false);
  const [map, setMap] = useState<ColonyMap>(() => loadBaseMap());
  const [savedFlash, setSavedFlash] = useState(false);
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [reloadingBank, setReloadingBank] = useState(false);
  const [orbitBankReloadSignal, setOrbitBankReloadSignal] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);

  async function handleResetSession() {
    if (resetting) return;
    setResetting(true);
    try {
      await resetTestSessionOnServer();
      setSessionEpoch((n) => n + 1);
    } catch (err) {
      console.error("resetTestSession failed", err);
    } finally {
      setResetting(false);
    }
  }

  async function handleReloadOrbitBank() {
    if (reloadingBank) return;
    setReloadingBank(true);
    try {
      await reloadOrbitBankOnServer();
      setOrbitBankReloadSignal((n) => n + 1);
    } catch (err) {
      console.error("reloadOrbitBank failed", err);
    } finally {
      setReloadingBank(false);
    }
  }

  async function captureScreenshot() {
    const node = frameRef.current;
    if (!node || capturing) return;

    setCapturing(true);
    try {
      const dataUrl = await captureMacbookPng(node);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const link = document.createElement("a");
      link.download = `on-mars-macbook-${stamp}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Screenshot failed", err);
    } finally {
      setCapturing(false);
    }
  }

  function handleSaveBase(next: ColonyMap) {
    const saved = saveBaseMap(next);
    setMap(saved);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  }

  return (
    <div className="test-shell">
      <aside className="test-toolbar">
        <div className="test-toolbar-head">
          <strong>Dev /test</strong>
          <a href="/" className="btn">
            Lobby réel
          </a>
        </div>
        <p className="muted">Sandbox UI — partie persistée sur le serveur.</p>
        <div className="test-scene-list">
          <button type="button" className="btn primary">
            On Mars
          </button>
        </div>

        <label className="test-frame-toggle">
          <input
            type="checkbox"
            checked={macbookFrame}
            onChange={(e) => setMacbookFrame(e.target.checked)}
          />
          <span>MacBook 13″ (1280×800)</span>
        </label>

        <label className="test-frame-toggle">
          <input
            type="checkbox"
            checked={editMap}
            onChange={(e) => setEditMap(e.target.checked)}
          />
          <span>Éditeur de carte</span>
        </label>

        {editMap && (
          <MapEditorPanel
            map={map}
            onChange={setMap}
            onSaveBase={handleSaveBase}
            onResetBundled={() => setMap(getBundledBaseMap())}
          />
        )}

        {savedFlash && (
          <p className="test-save-flash">Carte de base enregistrée (localStorage).</p>
        )}

        <p className="muted test-frame-hint">
          Partie unique <code>test-solo</code> — état sur le serveur de jeu.
        </p>
        <button
          type="button"
          className="btn test-screenshot-btn"
          onClick={() => void handleResetSession()}
          disabled={resetting}
        >
          {resetting ? "Reset…" : "Reset partie"}
        </button>
        <button
          type="button"
          className="btn test-screenshot-btn"
          onClick={() => void handleReloadOrbitBank()}
          disabled={reloadingBank}
        >
          {reloadingBank ? "Rechargement…" : "Recharger la banque"}
        </button>
        <p className="muted test-frame-hint">
          {macbookFrame
            ? "Cadre 1280×800 — décocher pour plein écran responsive."
            : "Plein écran responsive dans la zone de test."}
        </p>
        <button
          type="button"
          className="btn test-screenshot-btn"
          onClick={() => void captureScreenshot()}
          disabled={capturing}
        >
          {capturing ? "Capture…" : "Screenshot MacBook"}
        </button>
      </aside>

      <div className={`test-stage ${macbookFrame ? "is-macbook" : "is-fullscreen"}`}>
        <div ref={frameRef} className="test-game-frame">
          <OnMarsPage
            key={sessionEpoch}
            map={map}
            editMap={editMap}
            onMapChange={setMap}
            orbitBankReloadSignal={orbitBankReloadSignal}
          />
        </div>
      </div>
    </div>
  );
}
