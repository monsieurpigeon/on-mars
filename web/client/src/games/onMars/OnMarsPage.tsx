import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ColonyFlank } from "./ColonyFlank";
import { ColonyHexGrid } from "./ColonyHexGrid";
import type { ColonyMap } from "./colonyMap";
import { toggleCell } from "./colonyMap";
import {
  BOARD_ZONE_LABELS,
  createInitialTestSession,
  getPlayerState,
  setMissionTracker,
  setPlayerResourceAmount,
  type MissionId,
  type OrbitBankKind,
  type TestSession,
} from "./gameState";
import type { HexCell } from "./hexGrid";
import { OrbitFlank } from "./OrbitFlank";
import { PLAYERS, getPlayer } from "./players";
import { CrystalIcon } from "./CrystalIcon";
import { RocketIcon } from "./RocketIcon";
import { TechHexGrid } from "./TechHexGrid";
import {
  COLONY_RESOURCE_KINDS,
  COLONY_RESOURCE_LABELS,
  carryCapacity,
  resolveCarrySlotInteraction,
  type ColonyResourceKind,
} from "./colonyResources";
import { RESOURCE_KINDS, ResourceIcon, type ResourceKind } from "./ResourceIcon";
import {
  SHELTER_ROW_COUNT,
  SHELTER_SLOTS_PER_ROW,
  isShelterRowVisible,
  placeInVisibleShelters,
  shelterSlotKey,
} from "./shelters";
import {
  fetchTestSession,
  putTestSession,
  levelUpLssOnServer,
  updateMissionTrackerOnServer,
  updatePlayerResourceOnServer,
  takeOrbitBankOnServer,
} from "./testSessionApi";
import { MACBOOK_H, MACBOOK_W } from "../../lib/captureMacbook";
import { ZoneIcon } from "./ZoneIcon";
import "./onMars.css";

/** Stock UI de démo — à brancher sur l’état de jeu plus tard. */
const DEMO_STOCK: Record<ResourceKind, number> = {
  colon: 8,
  robot: 3,
  rover: 1,
  advanced_building: 9,
};

/** 3 colons dans les cases visibles libres, remplissage depuis le bas. */
const DEMO_SHELTER_OCCUPIED = placeInVisibleShelters(3);

/** Colons au travail (démo). */
const DEMO_WORKING_COLONISTS = 2;

/** Scientifiques disponibles sur le plateau perso (démo). */
const SCIENTIST_SLOTS = 6;
const DEMO_SCIENTISTS_AVAILABLE = 2;

/** Emplacements blueprints sous les scientifiques. */
const BLUEPRINT_SLOTS = 5;

/**
 * Grille 3×3 (haut → bas) + dépôt pleine largeur en bas :
 * 3 fusées / 2 fusées + centre vide / 3 cristaux.
 */
const CRYSTAL_GRID_CELLS = [
  "rocket",
  "rocket",
  "rocket",
  "rocket",
  "empty",
  "rocket",
  "crystal",
  "crystal",
  "crystal",
] as const;
type CrystalGridCell = (typeof CRYSTAL_GRID_CELLS)[number];

type Props = {
  map: ColonyMap;
  editMap?: boolean;
  onMapChange?: (map: ColonyMap) => void;
  /** Signal TestPage : refetch après rechargement banque. */
  orbitBankReloadSignal?: number;
};

export function OnMarsPage({
  map,
  editMap = false,
  onMapChange,
  orbitBankReloadSignal = 0,
}: Props) {
  const [session, setSession] = useState<TestSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const skipNextSave = useRef(true);
  const saveTimer = useRef<number | null>(null);
  const fsRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function syncFullscreen() {
      setIsFullscreen(document.fullscreenElement === fsRootRef.current);
    }
    function syncScale() {
      const root = fsRootRef.current;
      if (!root || document.fullscreenElement !== root) return;
      const scale = Math.min(
        window.innerWidth / MACBOOK_W,
        window.innerHeight / MACBOOK_H,
      );
      root.style.setProperty("--om-fs-scale", String(scale));
    }
    function onFullscreenChange() {
      syncFullscreen();
      syncScale();
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("resize", syncScale);
    syncFullscreen();
    syncScale();
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("resize", syncScale);
    };
  }, []);

  async function toggleFullscreen() {
    const root = fsRootRef.current;
    if (!root) return;
    try {
      if (document.fullscreenElement === root) {
        await document.exitFullscreen();
      } else {
        await root.requestFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen failed", err);
    }
  }

  useEffect(() => {
    let cancelled = false;
    skipNextSave.current = true;
    setSession(null);
    setLoadError(null);
    void fetchTestSession()
      .then((s) => {
        if (!cancelled) {
          skipNextSave.current = true;
          setSession(s);
        }
      })
      .catch(() => {
        if (!cancelled) {
          skipNextSave.current = true;
          setSession(createInitialTestSession());
          setLoadError("Serveur injoignable — session locale temporaire.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (saveTimer.current != null) {
      window.clearTimeout(saveTimer.current);
    }
    saveTimer.current = window.setTimeout(() => {
      void putTestSession(session).catch((err) => {
        console.error("putTestSession failed", err);
        setLoadError("Échec de sauvegarde serveur.");
      });
    }, 200);
    return () => {
      if (saveTimer.current != null) {
        window.clearTimeout(saveTimer.current);
      }
    };
  }, [session]);

  useEffect(() => {
    if (!orbitBankReloadSignal) return;
    if (saveTimer.current != null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    let cancelled = false;
    skipNextSave.current = true;
    void fetchTestSession()
      .then((s) => {
        if (!cancelled) {
          skipNextSave.current = true;
          setSession(s);
          setLoadError(null);
        }
      })
      .catch((err) => {
        console.error("orbit bank reload fetch failed", err);
        if (!cancelled) setLoadError("Échec rechargement banque.");
      });
    return () => {
      cancelled = true;
    };
  }, [orbitBankReloadSignal]);

  if (!session) {
    return (
      <div className="om-screen om-screen-loading">
        <p className="muted">Chargement de la partie serveur…</p>
      </div>
    );
  }

  const viewPlayerIndex = session.viewPlayerIndex;
  const game = session.game;
  const viewer = getPlayer(viewPlayerIndex);
  const viewerState = getPlayerState(game, viewPlayerIndex);

  function patchSession(
    patch: Partial<TestSession> | ((prev: TestSession) => TestSession),
  ) {
    setSession((prev) => {
      if (!prev) return prev;
      return typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
    });
  }

  function handleHexClick(cell: HexCell) {
    if (!editMap || !onMapChange) return;
    onMapChange(toggleCell(map, cell));
  }

  function applyServerSession(next: TestSession) {
    skipNextSave.current = true;
    setSession(next);
  }

  async function handleLssLevelUp() {
    skipNextSave.current = true;
    if (saveTimer.current != null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      applyServerSession(await levelUpLssOnServer());
      setLoadError(null);
    } catch (err) {
      console.error("levelUpLssOnServer failed", err);
      setLoadError("Impossible d’augmenter le LSS.");
    }
  }

  async function handleResourceAmountChange(
    kind: ColonyResourceKind,
    amount: number,
  ) {
    const capacity = carryCapacity(game.lssLevel);
    if (amount > capacity) {
      // Garde-fou : jamais au-dessus du seuil LSS
      return;
    }

    skipNextSave.current = true;
    patchSession((prev) => ({
      ...prev,
      game: setPlayerResourceAmount(prev.game, viewPlayerIndex, kind, amount),
    }));
    try {
      applyServerSession(
        await updatePlayerResourceOnServer(viewPlayerIndex, kind, amount),
      );
      setLoadError(null);
    } catch (err) {
      console.error("updatePlayerResourceOnServer failed", err);
      setLoadError("Échec mise à jour ressources.");
    }
  }

  async function handleMissionTrackerChange(
    missionId: MissionId,
    tracker: number,
  ) {
    skipNextSave.current = true;
    patchSession((prev) => ({
      ...prev,
      game: setMissionTracker(prev.game, missionId, tracker),
    }));
    try {
      applyServerSession(
        await updateMissionTrackerOnServer(missionId, tracker),
      );
      setLoadError(null);
    } catch (err) {
      console.error("updateMissionTrackerOnServer failed", err);
      setLoadError("Échec mise à jour mission.");
    }
  }

  async function handleOrbitBankTake(kind: OrbitBankKind) {
    skipNextSave.current = true;
    try {
      applyServerSession(
        await takeOrbitBankOnServer(viewPlayerIndex, kind),
      );
      setLoadError(null);
    } catch (err) {
      console.error("takeOrbitBankOnServer failed", err);
      setLoadError("Impossible de prendre cette ressource.");
    }
  }

  function handleCarrySlotClick(kind: ColonyResourceKind, slotIndex: number) {
    // Routine de gestion du portage (seuil LSS, extensions règles)
    const result = resolveCarrySlotInteraction({
      lssLevel: game.lssLevel,
      currentAmount: viewerState.resources?.[kind] ?? 0,
      slotIndex,
    });

    if (!result.ok) {
      if (result.reason === "above_capacity") {
        // Intentional no-op — ajout bloqué au-delà de LSS+1
        return;
      }
      return;
    }

    void handleResourceAmountChange(kind, result.amount);
  }

  return (
    <div ref={fsRootRef} className="om-fs-root">
      <div
        className={["om-screen", editMap ? "is-map-editing" : ""].filter(Boolean).join(" ")}
        style={
          {
            "--view-player": viewer.color,
            "--view-player-ink": viewer.ink,
            "--view-player-soft": viewer.soft,
          } as CSSProperties
        }
      >
      <button
        type="button"
        className={`om-fs-btn ${isFullscreen ? "is-active" : ""}`}
        onClick={() => void toggleFullscreen()}
        aria-pressed={isFullscreen}
        title={
          isFullscreen
            ? "Quitter le plein écran"
            : "Plein écran MacBook (1280×800)"
        }
        aria-label={
          isFullscreen
            ? "Quitter le plein écran"
            : "Plein écran MacBook 1280 par 800"
        }
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          {isFullscreen ? (
            <path
              d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
          ) : (
            <path
              d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
          )}
        </svg>
      </button>
      <section className="om-zone om-zone-game" aria-label="Zone de jeu">
        <div className="om-zone-label om-game-header">
          <div className="om-placement" aria-label="Zone de placement">
            <div className="om-placement-grid">
              {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className="om-placement-slot"
                  aria-label={`Emplacement ${n}`}
                />
              ))}
            </div>
          </div>

          <div className="om-header-right">
            <div className="om-scoreboard" aria-label="Scores">
              {PLAYERS.map((p) => {
                const ps = getPlayerState(game, p.index);
                return (
                  <div
                    key={p.index}
                    className={`om-score-slot is-${ps.zone}`}
                    style={{ "--tick": p.color } as CSSProperties}
                    title={`${p.name} — ${BOARD_ZONE_LABELS[ps.zone]}`}
                    aria-label={`${p.name} : ${ps.score} — ${BOARD_ZONE_LABELS[ps.zone]}`}
                  >
                    <span className="om-count om-score-value">{ps.score}</span>
                    <span className="om-score-zone" aria-hidden>
                      <ZoneIcon zone={ps.zone} size={12} />
                    </span>
                  </div>
                );
              })}
            </div>
            {editMap && <span className="om-edit-badge">Édition carte</span>}
          </div>
        </div>

        <div className="om-zone-body om-game-body">
          <div className="om-screen-main">
            <div className="om-common-board" aria-label="Zone de jeu commune">
              <OrbitFlank
                bank={game.orbitBank}
                onTake={(kind) => void handleOrbitBankTake(kind)}
              />
              <ColonyHexGrid
                map={map}
                editMode={editMap}
                editRadius={8}
                hexSize={editMap ? 14 : 20}
                onHexClick={handleHexClick}
                missions={game.missions}
                remainingMissions={game.remainingMissions}
                onMissionTrackerChange={(missionId, tracker) =>
                  void handleMissionTrackerChange(missionId, tracker)
                }
              />
            </div>

            <div className="om-personal-row">
              <aside className="om-player-col" aria-label="Sélection joueur">
                <div className="om-player-col-rail" aria-hidden />
                {PLAYERS.map((p) => (
                  <button
                    key={p.index}
                    type="button"
                    className={`om-player-btn ${p.index === viewPlayerIndex ? "is-active" : ""}`}
                    style={{ "--tick": p.color, "--tick-ink": p.ink } as CSSProperties}
                    onClick={() => patchSession({ viewPlayerIndex: p.index })}
                    aria-pressed={p.index === viewPlayerIndex}
                    title={p.name}
                  >
                    <span className="om-player-swatch" />
                    <span className="om-player-name">{p.name}</span>
                  </button>
                ))}
              </aside>

              <section
                className="om-zone om-zone-personal"
                aria-label={`Zone personnelle — ${viewer.name}`}
              >
                <div className="om-zone-body om-personal-body">
                  <div className="om-personal-layout">
                    <aside className="om-crystal-stock" aria-label="Zones et dépôt de cristaux">
                      <ul className="om-crystal-grid">
                        {CRYSTAL_GRID_CELLS.map((cell: CrystalGridCell, index) => (
                          <li key={index}>
                            {cell === "rocket" ? (
                              <div
                                className="om-crystal-slot om-crystal-zone is-blocked"
                                aria-label="Zone bloquée — fusée"
                              >
                                <RocketIcon className="om-crystal-slot-icon" />
                              </div>
                            ) : cell === "crystal" ? (
                              <div
                                className="om-crystal-slot om-crystal-filled"
                                aria-label="Cristal"
                              >
                                <CrystalIcon className="om-crystal-slot-icon" />
                              </div>
                            ) : (
                              <div
                                className="om-crystal-slot om-crystal-zone is-empty"
                                aria-label="Emplacement vide"
                              />
                            )}
                          </li>
                        ))}
                      </ul>
                      <div
                        className="om-crystal-depot"
                        aria-label={`Dépôt de cristaux : ${viewerState.crystalDepot}`}
                      >
                        <CrystalIcon className="om-crystal-depot-icon" />
                        <span className="om-count om-crystal-depot-count">
                          {viewerState.crystalDepot}
                        </span>
                      </div>
                    </aside>

                    <div className="om-personal-center">
                      <ul className="om-resource-cols" aria-label="Ressources">
                        {COLONY_RESOURCE_KINDS.map((kind) => {
                          const capacity = carryCapacity(game.lssLevel ?? 1);
                          const carried = viewerState.resources?.[kind] ?? 0;
                          return (
                            <li
                              key={kind}
                              className={`om-resource-col om-resource-col--${kind}`}
                              title={`${COLONY_RESOURCE_LABELS[kind]} — ${carried}/${capacity}`}
                            >
                              <div className="om-resource-col-head">
                                <span className="om-resource-col-label">
                                  {COLONY_RESOURCE_LABELS[kind]}
                                </span>
                                <span className="om-resource-count" aria-hidden>
                                  {carried}/{capacity}
                                </span>
                              </div>
                              <ul
                                className="om-carry-slots"
                                style={
                                  {
                                    "--om-carry-slots": capacity,
                                  } as CSSProperties
                                }
                                aria-label={`${COLONY_RESOURCE_LABELS[kind]} ${carried} sur ${capacity}`}
                              >
                                {Array.from({ length: capacity }, (_, slotIndex) => {
                                  const filled = slotIndex < carried;
                                  return (
                                    <li key={slotIndex}>
                                      <button
                                        type="button"
                                        className={`om-carry-slot ${filled ? "is-filled" : ""}`}
                                        aria-label={
                                          filled
                                            ? `Retirer jusqu’à ${slotIndex} ${COLONY_RESOURCE_LABELS[kind]}`
                                            : `Porter ${slotIndex + 1} ${COLONY_RESOURCE_LABELS[kind]}`
                                        }
                                        aria-pressed={filled}
                                        onClick={() =>
                                          handleCarrySlotClick(kind, slotIndex)
                                        }
                                      />
                                    </li>
                                  );
                                })}
                              </ul>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="om-personal-panel om-panel-tech" aria-label="Tech">
                        <TechHexGrid />
                      </div>

                      <aside
                        className="om-personal-panel om-panel-lab"
                        aria-label="Scientifiques et blueprints"
                      >
                        <ul
                          className="om-scientist-row"
                          aria-label={`Scientifiques disponibles : ${DEMO_SCIENTISTS_AVAILABLE} sur ${SCIENTIST_SLOTS}`}
                        >
                          {Array.from({ length: SCIENTIST_SLOTS }, (_, index) => {
                            const filled = index < DEMO_SCIENTISTS_AVAILABLE;
                            return (
                              <li key={index}>
                                <div
                                  className={`om-scientist-slot ${filled ? "is-filled" : ""}`}
                                  aria-label={
                                    filled
                                      ? `Scientifique ${index + 1}`
                                      : `Emplacement scientifique ${index + 1}`
                                  }
                                >
                                  {filled && (
                                    <ResourceIcon
                                      kind="colon"
                                      showTooltip={false}
                                      className="om-scientist-meeple"
                                      title="Scientifique"
                                    />
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                        <ul
                          className="om-blueprint-stack"
                          style={
                            {
                              "--om-blueprint-slots": BLUEPRINT_SLOTS,
                            } as CSSProperties
                          }
                          aria-label="Blueprints"
                        >
                          {Array.from({ length: BLUEPRINT_SLOTS }, (_, index) => (
                            <li key={index}>
                              <div
                                className="om-blueprint-slot"
                                aria-label={`Emplacement blueprint ${index + 1}`}
                              />
                            </li>
                          ))}
                        </ul>
                      </aside>
                    </div>

                    <aside className="om-personal-panel om-panel-shelters" aria-label="Abris">
                      <ul className="om-shelter-rows">
                        {Array.from({ length: SHELTER_ROW_COUNT }, (_, row) => {
                          const covered = !isShelterRowVisible(row);
                          return (
                            <li
                              key={row}
                              className={`om-shelter-row ${covered ? "is-covered" : ""}`}
                            >
                              {covered && (
                                <div className="om-shelter-row-cover" aria-hidden />
                              )}
                              {Array.from({ length: SHELTER_SLOTS_PER_ROW }, (_, slot) => {
                                const occupied = DEMO_SHELTER_OCCUPIED.has(
                                  shelterSlotKey(row, slot),
                                );
                                return (
                                  <button
                                    key={slot}
                                    type="button"
                                    className={`om-shelter-slot ${occupied ? "is-occupied" : ""}`}
                                    aria-label={
                                      occupied
                                        ? `Abri rangée ${row + 1}, case ${slot + 1} — colon`
                                        : `Abri rangée ${row + 1}, case ${slot + 1}`
                                    }
                                    tabIndex={covered ? -1 : 0}
                                    disabled={covered}
                                  >
                                    {occupied && (
                                      <ResourceIcon
                                        kind="colon"
                                        showTooltip={false}
                                        className="om-shelter-colon"
                                      />
                                    )}
                                  </button>
                                );
                              })}
                            </li>
                          );
                        })}
                      </ul>
                      <p
                        className="om-shelter-workers muted"
                        aria-label={`Colons au travail : ${DEMO_WORKING_COLONISTS}`}
                      >
                        <ResourceIcon
                          kind="colon"
                          showTooltip={false}
                          className="om-shelter-workers-icon"
                          title="Colons au travail"
                        />
                        <span className="om-count om-shelter-workers-count">
                          {DEMO_WORKING_COLONISTS}
                        </span>
                      </p>
                    </aside>
                  </div>
                </div>
              </section>

              <aside className="om-stock" aria-label="Stock ressources humaines">
                <ul className="om-stock-list">
                  {RESOURCE_KINDS.map((kind) => (
                    <li key={kind} className="om-stock-item">
                      <ResourceIcon kind={kind} tooltipSide="left" />
                      <span className="om-count om-stock-count">{DEMO_STOCK[kind]}</span>
                    </li>
                  ))}
                </ul>
              </aside>
            </div>
          </div>

          <aside className="om-side-rail om-rail-colony">
            <ColonyFlank
              lssLevel={game.lssLevel}
              onLevelUp={() => void handleLssLevelUp()}
            />
          </aside>
        </div>
      </section>
      {loadError && (
        <div className="om-error-modal" role="presentation">
          <div
            className="om-error-modal-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="om-error-modal-title"
            aria-describedby="om-error-modal-desc"
          >
            <h2 id="om-error-modal-title" className="om-error-modal-title">
              Erreur
            </h2>
            <p id="om-error-modal-desc" className="om-error-modal-message">
              {loadError}
            </p>
            <button
              type="button"
              className="om-error-modal-ok"
              onClick={() => setLoadError(null)}
              autoFocus
            >
              OK
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
