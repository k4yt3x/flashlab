import { useEffect, useRef, useState } from "react";

import {
  AXES,
  AXIS_NAMES,
  type Axis,
  type Picks,
  candidates,
  choices,
  labelOf,
  lookup,
  remainingAxes,
  settled,
} from "../models";

interface Props {
  value: string;
  onChange: (model: string) => void;
}

/** A model number box, with a wizard behind it for anyone who does not have the number to hand. */
export function ModelWizard({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const known = lookup(value);

  return (
    <section className="model">
      <h2>
        <label htmlFor="model-number">Model</label>{" "}
        <span className="aside">optional</span>
      </h2>
      <div className="row">
        <input
          id="model-number"
          className="number"
          value={value}
          spellCheck={false}
          autoComplete="off"
          maxLength={12}
          // Marked as an example, since a bare model number in an empty box reads as one that has
          // been applied.
          placeholder="e.g. H98UCF9PW6AN"
          onChange={(event) => onChange(event.target.value.toUpperCase())}
        />
        <button type="button" onClick={() => setOpen(true)}>
          Choose
        </button>
        {value ? (
          <button type="button" onClick={() => onChange("")}>
            Clear
          </button>
        ) : null}
      </div>
      {known ? (
        <p className="chosen">
          {known.family}
          {known.tier ? `, ${known.tier}` : ""}, {known.band}
        </p>
      ) : value.trim() ? (
        <p className="complaint">Unknown model number. No model rules are being applied.</p>
      ) : null}
      {open ? (
        <Wizard
          onCancel={() => setOpen(false)}
          onPick={(model) => {
            onChange(model);
            setOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}

/**
 * The four questions, asked one at a time, each offering only what the previous answers leave.
 *
 * An axis every remaining radio agrees on is skipped rather than asked, and the last step offers
 * model numbers, because four answers do not always narrow to one radio.
 */
function Wizard({ onPick, onCancel }: { onPick: (model: string) => void; onCancel: () => void }) {
  const [picks, setPicks] = useState<Picks>({});
  const sheet = useRef<HTMLDivElement>(null);

  // `aria-modal` tells a screen reader the rest of the page is unreachable, so it has to be true:
  // focus moves in on open and Escape gets back out.
  useEffect(() => {
    sheet.current?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onCancel]);

  const asking = remainingAxes(picks)[0];
  const found = candidates(picks);

  function answer(axis: Axis, value: string) {
    const next = { ...picks, [axis]: value };
    const one = settled(next);
    if (one) {
      onPick(one.model);
      return;
    }
    setPicks(next);
  }

  function back(axis: Axis) {
    // Unpick this axis and everything asked after it, so a change cannot leave a later answer
    // stranded on a radio it no longer applies to.
    const next: Picks = {};
    for (const held of AXES) {
      if (held === axis) {
        break;
      }
      if (picks[held] !== undefined) {
        next[held] = picks[held];
      }
    }
    setPicks(next);
  }

  return (
    <div className="wizard" role="dialog" aria-label="Choose a model" aria-modal="true">
      <div className="sheet" ref={sheet} tabIndex={-1}>
        <header>
          <h3>Choose a model</h3>
          <button type="button" onClick={onCancel}>
            Close
          </button>
        </header>

        {AXES.some((axis) => picks[axis] !== undefined) ? (
          <ul className="trail">
            {AXES.filter((axis) => picks[axis] !== undefined).map((axis) => (
              <li key={axis}>
                <button
                  type="button"
                  aria-label={`Change ${AXIS_NAMES[axis].toLowerCase()}, now ${labelOf(
                    picks[axis] ?? "",
                  )}`}
                  onClick={() => back(axis)}
                >
                  {labelOf(picks[axis] ?? "")} <span aria-hidden>&times;</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {asking ? (
          <>
            <p className="ask">{AXIS_NAMES[asking]}</p>
            <div className="options-grid">
              {choices(picks, asking).map((choice) => (
                <button key={choice} type="button" onClick={() => answer(asking, choice)}>
                  {labelOf(choice)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="ask">
              These {found.length} models differ by nothing left to ask. Pick one.
            </p>
            <div className="options-grid">
              {found.map((model) => (
                <button key={model.model} type="button" onClick={() => onPick(model.model)}>
                  {model.model}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="count">{found.length} models match</p>
      </div>
    </div>
  );
}
