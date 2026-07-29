import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { MACBOOK_H, MACBOOK_W } from "../../lib/captureMacbook";
import { ColonyFlank } from "./ColonyFlank";
import { ColonyHexGrid } from "./ColonyHexGrid";
import { CrystalIcon } from "./CrystalIcon";
import { MarsBackdrop } from "./MarsBackdrop";
import { OrbitFlank } from "./OrbitFlank";
import { RESOURCE_KINDS, ResourceIcon, type ResourceKind } from "./ResourceIcon";
import { RocketIcon } from "./RocketIcon";
import { SaturnIcon } from "./SaturnIcon";
import { TechHexGrid } from "./TechHexGrid";
import { ZoneIcon } from "./ZoneIcon";
import {
  blueprintResourceClass,
  getBlueprintDef,
} from "./blueprintCatalog";
import type { ColonyMap } from "./colonyMap";
import { toggleCell } from "./colonyMap";
import {
  COLONY_RESOURCE_KINDS,
  COLONY_RESOURCE_LABELS,
  carryCapacity,
  resolveCarrySlotInteraction,
  type ColonyResourceKind,
} from "./colonyResources";
import {
  BOARD_ZONE_LABELS,
  SCIENTIST_RESOURCES,
  SCIENTIST_RESOURCE_LABELS,
  buildingFillColor,
  buildingHexId,
  buildingInkColor,
  buildingLabel,
  buildingResourceKind,
  createInitialTestSession,
  getColonyRover,
  getPlayerState,
  leftmostAvailableTechSlots,
  reorderPlayerBlueprints,
  scientistResourceClass,
  setMissionTracker,
  setPlayerResourceAmount,
  type BlueprintCardId,
  type ColonyBuildingKind,
  type MissionId,
  type OrbitBankKind,
  type ScientistResource,
  type TechKind,
  type TechTopPayResource,
  type TestSession,
} from "./gameState";
import type { HexCell } from "./hexGrid";
import { hexId, hexNeighbors } from "./hexGrid";
import type { LssTrackResource } from "./lssResourceTrack";
import "./onMars.css";
import { PLAYERS, getPlayer } from "./players";
import {
  SHELTER_ROW_COUNT,
  SHELTER_SLOTS_PER_ROW,
  isShelterRowVisible,
  nextInstallableShelterRow,
  occupiedShelterSlotKeys,
  shelterSlotKey,
  visibleShelterCapacity,
} from "./shelters";
import {
  advanceLssResourceOnServer,
  advanceTechOnServer,
  fetchTestSession,
  installShelterOnServer,
  moveRoverOnServer,
  placeColonOnServer,
  placeLssPlayerTokenOnServer,
  putTestSession,
  recallWorkersOnServer,
  sendColonToWorkOnServer,
  takeBlueprintOnServer,
  takeOrbitBankOnServer,
  takeScientistOnServer,
  takeTechOnServer,
  updateMissionTrackerOnServer,
  updatePlayerResourceOnServer,
} from "./testSessionApi";

/** Stock UI de démo (hors colons / rover — gérés par le serveur). */
const DEMO_STOCK: Partial<Record<ResourceKind, number>> = {
  robot: 3,
  advanced_building: 9,
};

/**
 * Grille 3×3 (haut → bas) + dépôt pleine largeur en bas :
 * 3 fusées / 2 fusées + logo / 3 cristaux.
 */
const CRYSTAL_GRID_CELLS = [
  "rocket",
  "rocket",
  "rocket",
  "rocket",
  "logo",
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
  const dragBlueprintIndex = useRef<number | null>(null);
  const [pendingTech, setPendingTech] = useState<{
    kind: TechKind;
    payResource?: TechTopPayResource;
  } | null>(null);
  const [advancingKind, setAdvancingKind] = useState<TechKind | null>(null);

  useEffect(() => {
    setPendingTech(null);
    setAdvancingKind(null);
  }, [session?.viewPlayerIndex]);

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

  const hexFills = useMemo(() => {
    const fills: Record<
      string,
      {
        kind: ColonyBuildingKind;
        playerIndex?: number;
        fill: string;
        ink: string;
        label: string;
        resourceKind: ReturnType<typeof buildingResourceKind>;
      }
    > = {};
    for (const building of session?.game.colonyBuildings ?? []) {
      fills[buildingHexId(building)] = {
        kind: building.kind,
        playerIndex: building.playerIndex,
        fill: buildingFillColor(building),
        ink: buildingInkColor(building),
        label: buildingLabel(building),
        resourceKind: buildingResourceKind(building),
      };
    }
    return fills;
  }, [session?.game.colonyBuildings]);

  const roverMoveTargetIds = useMemo(() => {
    if (editMap || !session) return new Set<string>();
    const playerIndex = session.viewPlayerIndex;
    const rover = getColonyRover(session.game.colonyRovers, playerIndex);
    if (!rover) return new Set<string>();
    const mapIds = new Set(map.cells.map((c) => hexId(c)));
    const targets = new Set<string>();
    for (const n of hexNeighbors(rover)) {
      const id = hexId(n);
      if (mapIds.has(id)) targets.add(id);
    }
    return targets;
  }, [
    editMap,
    session?.viewPlayerIndex,
    session?.game.colonyRovers,
    map.cells,
  ]);

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
  const sheltersInstalled = viewerState.sheltersInstalled;
  const shelterOccupiedSet = occupiedShelterSlotKeys(
    viewerState.shelterColonists,
    sheltersInstalled,
  );
  const nextShelterRow = nextInstallableShelterRow(sheltersInstalled);
  const canPlaceColon =
    viewerState.colonStock > 0 &&
    viewerState.shelterColonists < visibleShelterCapacity(sheltersInstalled);
  const canSendColonToWork = viewerState.shelterColonists > 0;

  function patchSession(
    patch: Partial<TestSession> | ((prev: TestSession) => TestSession),
  ) {
    setSession((prev) => {
      if (!prev) return prev;
      return typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
    });
  }

  function handleHexClick(cell: HexCell) {
    if (editMap && onMapChange) {
      onMapChange(toggleCell(map, cell));
      return;
    }
    if (editMap) return;
    if (!roverMoveTargetIds.has(cell.id)) return;
    void handleMoveRover(cell.q, cell.r);
  }

  async function handleMoveRover(q: number, r: number) {
    skipNextSave.current = true;
    if (saveTimer.current != null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      applyServerSession(await moveRoverOnServer(viewPlayerIndex, q, r));
      setLoadError(null);
    } catch (err) {
      console.error("moveRoverOnServer failed", err);
      setLoadError("Impossible de déplacer le rover.");
    }
  }

  function applyServerSession(next: TestSession) {
    skipNextSave.current = true;
    setSession(next);
  }

  async function handleAdvanceLssResource(resource: LssTrackResource) {
    skipNextSave.current = true;
    if (saveTimer.current != null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      applyServerSession(await advanceLssResourceOnServer(resource));
      setLoadError(null);
    } catch (err) {
      console.error("advanceLssResourceOnServer failed", err);
      setLoadError("Impossible d’avancer le token LSS.");
    }
  }

  async function handlePlaceLssPlayerToken(kind: ColonyResourceKind) {
    skipNextSave.current = true;
    if (saveTimer.current != null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      applyServerSession(
        await placeLssPlayerTokenOnServer(viewPlayerIndex, kind),
      );
      setLoadError(null);
    } catch (err) {
      console.error("placeLssPlayerTokenOnServer failed", err);
      setLoadError("Impossible de placer le jeton LSS.");
    }
  }

  async function handleResourceAmountChange(
    kind: ColonyResourceKind,
    amount: number,
  ) {
    const capacity = carryCapacity(viewerState.sheltersInstalled);
    if (amount > capacity) {
      // Garde-fou : jamais au-dessus du seuil de portage
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

  async function handleTakeBlueprint(cardId: BlueprintCardId) {
    skipNextSave.current = true;
    try {
      applyServerSession(
        await takeBlueprintOnServer(viewPlayerIndex, cardId),
      );
      setLoadError(null);
    } catch (err) {
      console.error("takeBlueprintOnServer failed", err);
      setLoadError("Impossible de prendre ce plan.");
    }
  }

  async function handleTakeScientist(resource: ScientistResource) {
    skipNextSave.current = true;
    try {
      applyServerSession(
        await takeScientistOnServer(viewPlayerIndex, resource),
      );
      setLoadError(null);
    } catch (err) {
      console.error("takeScientistOnServer failed", err);
      setLoadError("Impossible de prendre ce scientifique.");
    }
  }

  function handleSelectTech(
    kind: TechKind,
    payResource?: TechTopPayResource,
  ) {
    if (leftmostAvailableTechSlots(viewerState.techs).length === 0) {
      setLoadError("Plus de place pour une techno.");
      return;
    }
    setAdvancingKind(null);
    setPendingTech({ kind, payResource });
  }

  async function handlePlacePendingTech(q: number, r: number) {
    if (!pendingTech) return;
    const { kind, payResource } = pendingTech;
    skipNextSave.current = true;
    if (saveTimer.current != null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      applyServerSession(
        await takeTechOnServer(
          viewPlayerIndex,
          kind,
          q,
          r,
          payResource,
        ),
      );
      setPendingTech(null);
      setLoadError(null);
    } catch (err) {
      console.error("takeTechOnServer failed", err);
      setLoadError("Impossible de placer la techno.");
    }
  }

  function handleSelectAdvanceTech(kind: TechKind) {
    setPendingTech(null);
    setAdvancingKind((prev) => (prev === kind ? null : kind));
  }

  async function handleAdvanceTechTo(q: number, r: number) {
    if (!advancingKind) return;
    const kind = advancingKind;
    skipNextSave.current = true;
    if (saveTimer.current != null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      applyServerSession(
        await advanceTechOnServer(viewPlayerIndex, kind, q, r),
      );
      setAdvancingKind(null);
      setLoadError(null);
    } catch (err) {
      console.error("advanceTechOnServer failed", err);
      setLoadError("Impossible d’évoluer la techno.");
    }
  }

  function handleBlueprintReorder(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    patchSession((prev) => ({
      ...prev,
      game: reorderPlayerBlueprints(
        prev.game,
        viewPlayerIndex,
        fromIndex,
        toIndex,
      ),
    }));
  }

  async function handlePlaceColon() {
    skipNextSave.current = true;
    if (saveTimer.current != null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      applyServerSession(await placeColonOnServer(viewPlayerIndex));
      setLoadError(null);
    } catch (err) {
      console.error("placeColonOnServer failed", err);
      setLoadError("Impossible de placer un colon (stock ou places).");
    }
  }

  async function handleShelterColonistClick() {
    if (!canSendColonToWork) return;
    skipNextSave.current = true;
    if (saveTimer.current != null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      applyServerSession(await sendColonToWorkOnServer(viewPlayerIndex));
      setLoadError(null);
    } catch (err) {
      console.error("sendColonToWorkOnServer failed", err);
      setLoadError("Impossible d’envoyer le colon au travail.");
    }
  }

  async function handleRecallWorkers() {
    if (viewerState.workingColonists <= 0) return;
    skipNextSave.current = true;
    if (saveTimer.current != null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      applyServerSession(await recallWorkersOnServer(viewPlayerIndex));
      setLoadError(null);
    } catch (err) {
      console.error("recallWorkersOnServer failed", err);
      setLoadError("Impossible de rapatrier les colons au travail.");
    }
  }

  async function handleInstallShelter() {
    skipNextSave.current = true;
    if (saveTimer.current != null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      applyServerSession(await installShelterOnServer(viewPlayerIndex));
      setLoadError(null);
    } catch (err) {
      console.error("installShelterOnServer failed", err);
      setLoadError("Impossible d’installer l’abri.");
    }
  }

  function handleCarrySlotClick(kind: ColonyResourceKind, slotIndex: number) {
    const result = resolveCarrySlotInteraction({
      sheltersInstalled: viewerState.sheltersInstalled,
      currentAmount: viewerState.resources?.[kind] ?? 0,
      slotIndex,
    });

    if (!result.ok) {
      if (result.reason === "above_capacity") {
        // Intentional no-op — ajout bloqué au-delà de la capacité
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
          <MarsBackdrop />
          <div className="om-zone-body om-game-body">
            <div className="om-game-top" aria-label="Placement et scores">
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

            <div className="om-screen-main">
              <div className="om-common-board" aria-label="Zone de jeu commune">
                <OrbitFlank
                  bank={game.orbitBank}
                  blueprints={game.blueprints ?? { rowBlue: [], rowRed: [] }}
                  techMarket={game.techMarket}
                  resources={viewerState.resources}
                  onTake={(kind) => void handleOrbitBankTake(kind)}
                  onTakeBlueprint={(cardId) => void handleTakeBlueprint(cardId)}
                  onTakeTech={(kind, pay) => handleSelectTech(kind, pay)}
                />
                <ColonyHexGrid
                  map={map}
                  editMode={editMap}
                  editRadius={8}
                  hexSize={editMap ? 14 : 20}
                  cellFills={hexFills}
                  rovers={game.colonyRovers}
                  moveTargetIds={roverMoveTargetIds}
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
                                  className="om-crystal-slot om-crystal-logo"
                                  aria-label="On Mars"
                                >
                                  <span className="om-crystal-logo-text">
                                    On
                                    <br />
                                    Mars
                                    <br />
                                    VR
                                  </span>
                                </div>
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

                      <div
                        className="om-personal-panel om-panel-resources"
                        aria-label="Ressources"
                      >
                        <ul className="om-resource-cols">
                          {COLONY_RESOURCE_KINDS.map((kind) => {
                            const capacity = carryCapacity(
                              viewerState.sheltersInstalled,
                            );
                            const carried = viewerState.resources?.[kind] ?? 0;
                            const lssPlaced = (
                              game.lssPlayerTokens?.[kind] ?? []
                            ).includes(viewPlayerIndex);
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
                                  <button
                                    type="button"
                                    className={`om-resource-col-player ${
                                      lssPlaced ? "is-placed" : ""
                                    }`}
                                    aria-label={
                                      lssPlaced
                                        ? `Jeton LSS déjà placé — ${COLONY_RESOURCE_LABELS[kind]}`
                                        : `Placer jeton LSS — ${COLONY_RESOURCE_LABELS[kind]}`
                                    }
                                    title={
                                      lssPlaced
                                        ? `Déjà placé sous ${COLONY_RESOURCE_LABELS[kind]}`
                                        : `Placer sous ${COLONY_RESOURCE_LABELS[kind]}`
                                    }
                                    aria-pressed={lssPlaced}
                                    disabled={lssPlaced}
                                    onClick={() =>
                                      void handlePlaceLssPlayerToken(kind)
                                    }
                                  />
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
                      </div>

                      <div className="om-panel-tech-col">
                        <div className="om-player-title" aria-label={`Joueur — ${viewer.name}`}>
                          {viewer.name}
                        </div>
                        <div className="om-personal-panel om-panel-tech" aria-label="Tech">
                          <TechHexGrid
                            techs={viewerState.techs}
                            placeable={pendingTech != null}
                            onPlace={(q, r) => void handlePlacePendingTech(q, r)}
                            advancingKind={advancingKind}
                            onSelectAdvance={handleSelectAdvanceTech}
                            onAdvanceTo={(q, r) => void handleAdvanceTechTo(q, r)}
                          />
                        </div>
                      </div>

                      <aside
                        className="om-personal-panel om-panel-lab"
                        aria-label="Scientifiques et blueprints"
                      >
                          <ul
                            className="om-scientist-row"
                            aria-label={`Scientifiques : ${(viewerState.scientists ?? []).length} sur ${SCIENTIST_RESOURCES.length}`}
                          >
                            {SCIENTIST_RESOURCES.map((resource) => {
                              const filled = (viewerState.scientists ?? []).includes(
                                resource,
                              );
                              const resLabel = SCIENTIST_RESOURCE_LABELS[resource];
                              return (
                                <li key={resource}>
                                  <div
                                    className={`om-scientist-slot ${scientistResourceClass(resource)} ${filled ? "is-filled" : ""}`}
                                    aria-label={
                                      filled
                                        ? `Scientifique ${resLabel}`
                                        : `Emplacement scientifique ${resLabel}`
                                    }
                                    title={resLabel}
                                  >
                                    {filled && (
                                      <ResourceIcon
                                        kind="colon"
                                        showTooltip={false}
                                        className="om-scientist-meeple"
                                        title={resLabel}
                                      />
                                    )}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                          <ul
                            className="om-blueprint-stack"
                            aria-label="Blueprints"
                          >
                            {(viewerState.blueprints ?? []).map((cardId, index) => {
                              const def = getBlueprintDef(cardId);
                              const resource = def?.resource ?? "energie";
                              const title = def?.name ?? `Plan ${cardId}`;
                              const bpClass = cardId <= 12 ? 1 : 2;
                              const vp = bpClass === 1 ? 3 : 5;
                              return (
                                <li
                                  key={cardId}
                                  className="om-blueprint-stack-item"
                                  draggable
                                  onDragStart={(e) => {
                                    dragBlueprintIndex.current = index;
                                    e.dataTransfer.effectAllowed = "move";
                                    e.dataTransfer.setData("text/plain", String(index));
                                    (e.currentTarget as HTMLElement).classList.add(
                                      "is-dragging",
                                    );
                                  }}
                                  onDragEnd={(e) => {
                                    dragBlueprintIndex.current = null;
                                    (e.currentTarget as HTMLElement).classList.remove(
                                      "is-dragging",
                                    );
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = "move";
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    const from =
                                      dragBlueprintIndex.current ??
                                      Number(e.dataTransfer.getData("text/plain"));
                                    if (!Number.isFinite(from)) return;
                                    handleBlueprintReorder(from, index);
                                    dragBlueprintIndex.current = null;
                                  }}
                                >
                                  <div
                                    className={`om-blueprint-slot is-owned is-bp-class-${bpClass} ${blueprintResourceClass(resource)}`}
                                    aria-label={`${title}, ${vp} PV — glisser pour réordonner`}
                                    title={`${title} · ${vp} PV`}
                                  >
                                    <span className="om-blueprint-slot-title">{title}</span>
                                    <span className="om-blueprint-slot-vp">
                                      {vp}
                                      <SaturnIcon
                                        size="0.8em"
                                        className="om-blueprint-slot-vp-icon"
                                      />
                                    </span>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </aside>

                      <aside className="om-personal-panel om-panel-shelters" aria-label="Abris">
                        <ul className="om-shelter-rows">
                          {Array.from({ length: SHELTER_ROW_COUNT }, (_, row) => {
                            const covered = !isShelterRowVisible(row, sheltersInstalled);
                            const canInstall = covered && row === nextShelterRow;
                            return (
                              <li
                                key={row}
                                className={`om-shelter-row ${covered ? "is-covered" : ""} ${canInstall ? "is-installable" : ""}`}
                              >
                                {covered &&
                                  (canInstall ? (
                                    <button
                                      type="button"
                                      className="om-shelter-row-cover is-installable"
                                      aria-label={`Installer l’abri rangée ${row + 1}`}
                                      onClick={() => void handleInstallShelter()}
                                    />
                                  ) : (
                                    <div className="om-shelter-row-cover" aria-hidden />
                                  ))}
                                {Array.from({ length: SHELTER_SLOTS_PER_ROW }, (_, slot) => {
                                  const occupied = shelterOccupiedSet.has(
                                    shelterSlotKey(row, slot),
                                  );
                                  const canPlaceHere = !covered && !occupied && canPlaceColon;
                                  const canSendHere = !covered && occupied && canSendColonToWork;
                                  return (
                                    <button
                                      key={slot}
                                      type="button"
                                      className={`om-shelter-slot ${occupied ? "is-occupied" : ""}`}
                                      aria-label={
                                        occupied
                                          ? `Envoyer un colon au travail`
                                          : canPlaceHere
                                            ? `Placer un colon (empilé vers le bas)`
                                            : `Abri rangée ${row + 1}, case ${slot + 1}`
                                      }
                                      tabIndex={
                                        covered || (!canPlaceHere && !canSendHere) ? -1 : 0
                                      }
                                      disabled={covered || (!canPlaceHere && !canSendHere)}
                                      onClick={() => {
                                        if (canSendHere) {
                                          void handleShelterColonistClick();
                                        } else if (canPlaceHere) {
                                          void handlePlaceColon();
                                        }
                                      }}
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
                        <button
                          type="button"
                          className="om-shelter-workers muted"
                          aria-label={`Rapatrier ${viewerState.workingColonists} colon(s) au travail`}
                          disabled={viewerState.workingColonists <= 0}
                          onClick={() => void handleRecallWorkers()}
                        >
                          <ResourceIcon
                            kind="colon"
                            showTooltip={false}
                            className="om-shelter-workers-icon"
                            title="Colons au travail"
                          />
                          <span className="om-count om-shelter-workers-count">
                            {viewerState.workingColonists}
                          </span>
                        </button>
                      </aside>
                    </div>
                  </div>
                </section>

                <aside className="om-stock" aria-label="Stock ressources humaines">
                  <ul className="om-stock-list">
                    {RESOURCE_KINDS.map((kind) => {
                      if (kind === "colon") {
                        return (
                          <li key={kind} className="om-stock-item">
                            <button
                              type="button"
                              className="om-stock-colon-btn"
                              aria-label={`Placer un colon depuis le stock (${viewerState.colonStock})`}
                              disabled={!canPlaceColon}
                              onClick={() => void handlePlaceColon()}
                            >
                              <ResourceIcon kind={kind} tooltipSide="left" />
                              <span className="om-count om-stock-count">
                                {viewerState.colonStock}
                              </span>
                            </button>
                          </li>
                        );
                      }
                      if (kind === "rover") {
                        return (
                          <li key={kind} className="om-stock-item">
                            <ResourceIcon kind={kind} tooltipSide="left" />
                            <span className="om-count om-stock-count">
                              {viewerState.roverStock}
                            </span>
                          </li>
                        );
                      }
                      return (
                        <li key={kind} className="om-stock-item">
                          <ResourceIcon kind={kind} tooltipSide="left" />
                          <span className="om-count om-stock-count">
                            {DEMO_STOCK[kind] ?? 0}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </aside>
              </div>
            </div>

            <aside className="om-side-rail om-rail-colony">
              <ColonyFlank
                lssLevel={game.lssLevel}
                lssRewardRow={game.lssRewardRow}
                lssResourceTrack={game.lssResourceTrack}
                lssPlayerTokens={game.lssPlayerTokens}
                scientistMarket={game.scientists}
                onAdvanceResource={(resource) => void handleAdvanceLssResource(resource)}
                onTakeScientist={(resource) => void handleTakeScientist(resource)}
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
