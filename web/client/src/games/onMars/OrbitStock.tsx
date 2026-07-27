import { useEffect, useRef, useState } from "react";
import { ActionRoundButton } from "./ActionRoundButton";
import { CrystalIcon } from "./CrystalIcon";
import {
  ORBIT_BANK_KINDS,
  ORBIT_BANK_LABELS,
  ORBIT_BANK_STACK,
  type OrbitBank,
  type OrbitBankKind,
} from "./gameState";

type Props = {
  bank: OrbitBank;
  disabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
  onTake?: (kind: OrbitBankKind) => void;
};

function cloneBank(bank: OrbitBank): OrbitBank {
  return {
    cristal: bank.cristal,
    energie: bank.energie,
    eau: bank.eau,
    plante: bank.plante,
    oxygene: bank.oxygene,
    generation: bank.generation,
  };
}

function bankEqualsCounts(a: OrbitBank, b: OrbitBank): boolean {
  return ORBIT_BANK_KINDS.every((kind) => a[kind] === b[kind]);
}

/** Banque orbite — colonnes de 3 (cristal → oxygène). */
export function OrbitStock({
  bank,
  disabled = false,
  selected = false,
  onClick,
  onTake,
}: Props) {
  const [display, setDisplay] = useState<OrbitBank>(() => cloneBank(bank));
  const [reloading, setReloading] = useState(false);
  const seenGeneration = useRef(bank.generation);
  const displayRef = useRef(display);
  const animTimer = useRef<number | null>(null);
  displayRef.current = display;

  useEffect(() => {
    if (bank.generation === seenGeneration.current) {
      setDisplay((prev) =>
        prev.generation === bank.generation && bankEqualsCounts(prev, bank)
          ? prev
          : cloneBank(bank),
      );
      return;
    }

    seenGeneration.current = bank.generation;
    const target = cloneBank(bank);
    const start = cloneBank(displayRef.current);
    start.generation = bank.generation;
    for (const kind of ORBIT_BANK_KINDS) {
      start[kind] = Math.min(start[kind], target[kind]);
    }

    if (animTimer.current != null) {
      window.clearTimeout(animTimer.current);
      animTimer.current = null;
    }

    setReloading(true);
    setDisplay(start);

    let cancelled = false;

    function step(current: OrbitBank) {
      if (cancelled) return;
      if (bankEqualsCounts(current, target)) {
        setDisplay(cloneBank(target));
        setReloading(false);
        return;
      }

      const lacking = ORBIT_BANK_KINDS.filter(
        (kind) => current[kind] < target[kind],
      );
      if (lacking.length === 0) {
        setDisplay(cloneBank(target));
        setReloading(false);
        return;
      }

      const pick = lacking[Math.floor(Math.random() * lacking.length)]!;
      const next = { ...current, [pick]: current[pick] + 1 };
      setDisplay(next);
      animTimer.current = window.setTimeout(
        () => step(next),
        90 + Math.random() * 120,
      );
    }

    if (bankEqualsCounts(start, target)) {
      setDisplay(cloneBank(target));
      setReloading(false);
      return;
    }

    animTimer.current = window.setTimeout(() => step(start), 280);

    return () => {
      cancelled = true;
      if (animTimer.current != null) {
        window.clearTimeout(animTimer.current);
        animTimer.current = null;
      }
    };
  }, [bank]);

  return (
    <div
      className={[
        "om-orbit-stock",
        reloading ? "is-reloading" : "",
        selected ? "is-selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Stock orbite"
      aria-busy={reloading}
    >
      <div className="om-action-head">
        <span className="om-orbit-stock-title">Stock</span>
        <ActionRoundButton
          label="Stock"
          tone="orbit"
          selected={selected}
          onClick={onClick}
        />
      </div>
      <div className="om-orbit-stock-table" role="table">
        {ORBIT_BANK_KINDS.map((kind) => {
          const count = display[kind];
          const canTake = !disabled && !reloading && bank[kind] > 0;
          return (
            <button
              key={kind}
              type="button"
              className={`om-orbit-stock-col om-orbit-stock-col--${kind}`}
              role="columnheader"
              disabled={!canTake}
              aria-label={`${ORBIT_BANK_LABELS[kind]} — ${count} sur ${ORBIT_BANK_STACK}`}
              title={ORBIT_BANK_LABELS[kind]}
              onClick={() => onTake?.(kind)}
            >
              <ul className="om-orbit-stock-stack" aria-hidden>
                {Array.from({ length: ORBIT_BANK_STACK }, (_, slot) => {
                  const fromTop = ORBIT_BANK_STACK - 1 - slot;
                  const filled = fromTop < count;
                  return (
                    <li
                      key={slot}
                      className={`om-orbit-stock-slot ${filled ? "is-filled" : ""}`}
                    >
                      {filled && kind === "cristal" && (
                        <CrystalIcon className="om-orbit-stock-token" />
                      )}
                    </li>
                  );
                })}
              </ul>
              <span className="om-orbit-stock-col-label">
                {ORBIT_BANK_LABELS[kind]}
              </span>
            </button>
          );
        })}
      </div>

      {reloading && (
        <div className="om-orbit-stock-loading" role="status">
          <span className="om-orbit-stock-loading-text">Rechargement en cours</span>
        </div>
      )}
    </div>
  );
}
