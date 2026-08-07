import { useLayoutEffect, useRef, useState } from "react";

import { type Code } from "../flashcode";
import { type Option, type Radio, nameOf, troubleIn, troubleWith, variantsFor } from "../options";

/** Where on screen the row being described sits, so the card can be put beside it. */
export interface Anchor {
  top: number;
  left: number;
  right: number;
}

/** How large a window the card is being placed in. */
interface Viewport {
  width: number;
  height: number;
}

export const WIDTH = 340;
const GAP = 10;
/**
 * What to assume a card comes to before one has been measured, which is the first paint only.
 *
 * A guess is all this can be, and it used to be the only thing keeping a card on screen. That was
 * fine while every card was a title, a sentence and two lines; naming each cited part number took
 * the tallest to three times this, and a guess that stale positions a card most of the way off the
 * bottom. So it is measured after it renders and this is only the opening bid.
 */
const TALL = 220;

/**
 * Where to put the card.
 *
 * Left of the row where the window allows, which is over the bit grid. That is deliberate and is
 * what the delay pays for: hovering an option lights up the bits it occupies, and the card holds
 * off long enough to read them before covering them. Sweeping down the list never raises it at all.
 *
 * Where there is no room to the left, it goes right rather than off screen.
 */
export function place(
  anchor: Anchor,
  viewport: Viewport,
  height: number = TALL,
): { top: number; left: number } {
  const beside = anchor.left - WIDTH - GAP;
  const left =
    beside >= GAP ? beside : Math.min(anchor.right + GAP, viewport.width - WIDTH - GAP);
  return {
    top: Math.max(GAP, Math.min(anchor.top, viewport.height - height - GAP)),
    left: Math.max(GAP, left),
  };
}

/**
 * The part numbers a requirement or a conflict names, each with what it is.
 *
 * One per line rather than a comma-separated run: with the name attached an entry reaches sixty
 * characters, and several of those joined by commas is a paragraph to be parsed rather than a list
 * to be scanned.
 *
 * The ones the code is in trouble over are picked out, and nothing is added to say how: what a
 * requirement is short of is the option being off, and what a conflict is about is it being on.
 * Which list an entry is under says which of those it is, so the mark is the whole message.
 */
function Cited({
  what,
  parts,
  className,
  wrong,
}: {
  what: string;
  parts: readonly string[];
  className: string;
  /** Which of these part numbers the code is in trouble over, of the ones cited here. */
  wrong: readonly string[];
}) {
  return (
    <span className={className}>
      {what}{" "}
      {parts.map((part) => {
        const name = nameOf(part);
        return (
          <span className={wrong.includes(part) ? "cited wrong" : "cited"} key={part}>
            <span className="part">{part}</span>
            {name ? ` ${name}` : ""}
          </span>
        );
      })}
    </span>
  );
}

/**
 * What the option catalogue says about the option under the pointer.
 *
 * Placed against the row rather than following the cursor, so it does not jitter, and it never
 * takes the pointer, since it exists only while the pointer is somewhere else.
 *
 * Narrowed to the radio, because the catalogue answers separately for a mobile and a portable and
 * the two answers name different part numbers. See [`variantsFor`].
 */
export function OptionDetail({
  option,
  code,
  radio,
  anchor,
}: {
  option: Option;
  code: Code;
  radio: Radio;
  anchor: Anchor;
}) {
  const info = option.info;
  // Measured rather than assumed, because how tall a card comes to depends on how much the
  // catalogue has to say about the option, and that ranges from three lines to fifteen. A layout
  // effect runs before the browser paints, so the corrected position is the first one seen.
  const card = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    setHeight(card.current?.offsetHeight || undefined);
  }, [info, radio]);

  if (!info) {
    return null;
  }

  const { top, left } = place(
    anchor,
    { width: window.innerWidth, height: window.innerHeight },
    height,
  );
  // Marked only where the list marks the row. Each entry is read on its own, so an option listed
  // twice shows what each of the two would need, but an option satisfying either of them is in no
  // trouble at all and a card pointing at part numbers would be inventing a fault.
  const troubled = troubleWith(option, code, radio) !== null;

  return (
    <div className="detail" ref={card} style={{ top, left, width: WIDTH }}>
      <p className="title">{info.title}</p>
      <p className="what">{info.description}</p>
      {variantsFor(info, radio).map((variant) => {
        const trouble = troubled ? troubleIn(variant, code, radio) : null;
        return (
          <div className="variant" key={variant.for || "both"}>
            {variant.for ? <span className="for">{variant.for}</span> : null}
            <span className="release">Release {variant.release}</span>
            {variant.requires.length > 0 ? (
              <Cited
                what="Requires"
                parts={variant.requires}
                className="requires"
                wrong={trouble?.unmet ?? []}
              />
            ) : null}
            {variant.conflicts.length > 0 ? (
              <Cited
                what="Conflicts with"
                parts={variant.conflicts}
                className="conflicts"
                wrong={trouble?.clashing ?? []}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
