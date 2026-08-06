import { type Info, type Radio, variantsFor } from "../options";

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
/** Roughly what the tallest card comes to, used only to keep one off the bottom edge. */
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
export function place(anchor: Anchor, viewport: Viewport): { top: number; left: number } {
  const beside = anchor.left - WIDTH - GAP;
  const left =
    beside >= GAP ? beside : Math.min(anchor.right + GAP, viewport.width - WIDTH - GAP);
  return {
    top: Math.max(GAP, Math.min(anchor.top, viewport.height - TALL)),
    left: Math.max(GAP, left),
  };
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
  info,
  radio,
  anchor,
}: {
  info: Info;
  radio: Radio;
  anchor: Anchor;
}) {
  const { top, left } = place(anchor, {
    width: window.innerWidth,
    height: window.innerHeight,
  });

  return (
    <div className="detail" style={{ top, left, width: WIDTH }}>
      <p className="title">{info.title}</p>
      <p className="what">{info.description}</p>
      {variantsFor(info, radio).map((variant) => (
        <div className="variant" key={variant.for || "both"}>
          {variant.for ? <span className="for">{variant.for}</span> : null}
          <span className="release">Release {variant.release}</span>
          {variant.requires.length > 0 ? (
            <span className="requires">Requires {variant.requires.join(", ")}</span>
          ) : null}
          {variant.conflicts.length > 0 ? (
            <span className="conflicts">Conflicts with {variant.conflicts.join(", ")}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
