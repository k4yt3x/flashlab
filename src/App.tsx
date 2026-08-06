import { useCallback, useEffect, useMemo, useState } from "react";

import { BitGrid } from "./components/BitGrid";
import { ModelWizard } from "./components/ModelWizard";
import { OptionList } from "./components/OptionList";
import {
  BITS,
  ParseError,
  empty,
  format,
  full,
  parse,
  parseValues,
  same,
} from "./flashcode";
import * as fragment from "./fragment";
import { rebuild } from "./oem";
import { isKnown } from "./models";
import {
  OPTIONS,
  type Option,
  UNKNOWN,
  groups as groupsOf,
  namedBits,
  radioOf,
} from "./options";

export default function App() {
  const opened = useMemo(() => fragment.read(window.location.hash), []);
  const [code, setCode] = useState<number[]>(() => opened.code ?? empty());
  const [written, setWritten] = useState(() => format(opened.code ?? empty()));
  const [complaint, setComplaint] = useState<string | null>(null);
  const [model, setModel] = useState(opened.model);
  const [filter, setFilter] = useState("");
  const [offeredOnly, setOfferedOnly] = useState(false);
  const [hovered, setHovered] = useState<Option[]>([]);
  const [pinned, setPinned] = useState<Option[]>([]);

  // A model number only decides anything once it names a radio. Half of one still starts with the
  // character the rules read, so trusting it would mark options as not offered on the strength of a
  // string that names nothing.
  const radio = useMemo(() => (isKnown(model) ? radioOf(model) : UNKNOWN), [model]);
  // Nothing can be judged against a model that did not resolve, so nothing can be hidden either.
  const resolved = radio.mobile !== null;
  const groups = useMemo(() => groupsOf(OPTIONS), []);
  const named = useMemo(() => namedBits(), []);

  // The grid and the list point at each other: whichever the pointer is over lights up the bits or
  // the options the other one holds.
  const litBits = useMemo(() => {
    const bits = new Set<number>();
    for (const option of hovered) {
      for (let at = 0; at < option.width; at += 1) {
        bits.add(option.character * BITS + option.lsb + at);
      }
    }
    return bits;
  }, [hovered]);
  const litOptions = useMemo(() => new Set(hovered.map((option) => option.id)), [hovered]);
  const pinnedIds = useMemo(() => new Set(pinned.map((option) => option.id)), [pinned]);

  /**
   * Show the options a bit belongs to, from a right click on the grid.
   *
   * Anything hiding the target is undone first, since jumping to a row that is not shown would
   * look like nothing happening at all. A bit no option names does nothing, which its dimmed cell
   * already says.
   */
  const jump = useCallback((options: Option[]) => {
    if (options.length === 0) {
      return;
    }
    setFilter("");
    setOfferedOnly(false);
    setPinned(options);
  }, []);

  const adopt = useCallback((next: number[]) => {
    setCode(next);
    setWritten(format(next));
    setComplaint(null);
  }, []);

  // What a second person needs to see the same page, and nothing that would leave the browser: a
  // fragment is not sent with the request. The filter stays out of it, being a search rather than
  // a state worth carrying.
  //
  // A page holding nothing gets no fragment rather than one naming the empty code, so the address
  // stays bookmarkable until there is something in it worth sharing.
  useEffect(() => {
    const written = fragment.write(code, model);
    const { pathname, search } = window.location;
    window.history.replaceState(null, "", written ? `#${written}` : `${pathname}${search}`);
  }, [code, model]);

  function read(text: string) {
    setWritten(text);
    if (!text.trim()) {
      setComplaint(null);
      return;
    }
    try {
      const { code: next, stated, expected, width } = parse(text);
      setCode(next);
      setComplaint(
        stated !== null && stated !== expected
          ? `Check digit is ${stated}, should be ${expected}. The code was read anyway.`
          : width === 12
            ? "Read as a legacy 12-digit code, zero padded."
            : null,
      );
    } catch (error) {
      // A run of numbers is the other form a code turns up in, so try that before complaining.
      for (const radix of [16, 10]) {
        try {
          setCode(parseValues(text, radix));
          setComplaint(`Read as ${radix === 16 ? "hexadecimal" : "decimal"} digit values.`);
          return;
        } catch {
          // Not that form either.
        }
      }
      setComplaint(error instanceof ParseError ? error.message : String(error));
    }
  }

  const oem = useMemo(() => rebuild(code, radio, OPTIONS), [code, radio]);

  return (
    <div className="app">
      <header className="banner">
        <h1>FLASHlab</h1>
        <span className="build">
          {import.meta.env.VITE_VERSION ? `v${import.meta.env.VITE_VERSION}` : null}
          {import.meta.env.VITE_COMMIT ? (
            <>
              {" · "}
              <a
                href={`https://github.com/k4yt3x/flashlab/commit/${import.meta.env.VITE_COMMIT}`}
                aria-label={`Source at commit ${import.meta.env.VITE_COMMIT}`}
              >
                {import.meta.env.VITE_COMMIT}
              </a>
            </>
          ) : null}
        </span>
      </header>

      <main>
      <div className="panes">
        <div className="column">
          <section className="code">
            <h2>
              <label htmlFor="flashcode">FLASHcode</label>
            </h2>
            <input
              id="flashcode"
              className="written"
              value={written}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => read(event.target.value)}
              placeholder="%%%%%%-%%%%%%-4-%%%%%%-%%%%%%"
            />
            <div className="actions">
              <button type="button" onClick={() => adopt(empty())}>
                Empty
              </button>
              <button type="button" onClick={() => adopt(full())}>
                Full
              </button>
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(format(code))}
              >
                Copy
              </button>
            </div>
            {complaint ? <p className="complaint">{complaint}</p> : null}
            {format(code) !== written.trim() ? (
              <p className="summary">Canonical form: {format(code)}</p>
            ) : null}
          </section>

          <ModelWizard value={model} onChange={setModel} />

          <section className="pane bits">
            <h2>Bits</h2>
            <p className="note">
              Dimmed cells are unknown. Right click to jump to option.
            </p>
            <BitGrid
              code={code}
              named={named}
              highlight={litBits}
              onChange={adopt}
              onHover={setHovered}
              onJump={jump}
            />
          </section>
        </div>

        <section className="pane wide">
          <h2>Options</h2>
          <div className="narrowing">
            <input
              className="filter"
              value={filter}
              spellCheck={false}
              autoComplete="off"
              aria-label="Filter options"
              placeholder="Filter by part number or name"
              onChange={(event) => setFilter(event.target.value)}
            />
            <label
              className="offered"
              title={
                resolved
                  ? `Leave out the options ${radio.model} does not carry`
                  : "Enter a model, and the options it does not carry can be hidden"
              }
            >
              <input
                type="checkbox"
                checked={offeredOnly}
                disabled={!resolved}
                onChange={(event) => setOfferedOnly(event.target.checked)}
              />
              Hide not offered
            </label>
          </div>
          <OptionList
            code={code}
            groups={groups}
            radio={radio}
            filter={filter}
            highlight={litOptions}
            pinned={pinnedIds}
            offeredOnly={offeredOnly}
            onChange={adopt}
            onHover={setHovered}
          />
        </section>
      </div>

      <section className="oem">
        <h2>What an OEM encoder would produce</h2>
        <p className="note">
          Built from zero, dropping bits it cannot name and options the model does not offer.
        </p>
        <p className="written">{format(oem.code)}</p>
        <ul className="losses">
          <li>kept {oem.kept.length}</li>
          <li>refused {oem.refused.length}</li>
          <li>lost {oem.dropped.length} set {oem.dropped.length === 1 ? "bit" : "bits"}</li>
        </ul>
        <div className="actions">
          <button
            type="button"
            className="copy"
            aria-label="Copy the OEM encoder's code"
            onClick={() => void navigator.clipboard.writeText(format(oem.code))}
          >
            Copy
          </button>
          <button type="button" disabled={same(oem.code, code)} onClick={() => adopt(oem.code)}>
            Apply
          </button>
        </div>
      </section>
      </main>

      <footer>
        <p>
          Copyright &copy; 2023-2026 K4YT3X. Released under the MIT License.{" "}
          <a href="https://github.com/k4yt3x/flashlab">Source code</a>.
        </p>
        <p className="marks">
          Motorola, Motorola Solutions, APX, SRX and FLASHcode are trademarks or registered
          trademarks of Motorola Solutions, Inc. Other product names used here are trademarks of
          their respective owners. All are used for identification only. FLASHlab is an independent
          project for educational purposes only, not affiliated with or endorsed by Motorola
          Solutions, Inc.
        </p>
      </footer>
    </div>
  );
}

