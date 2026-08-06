import { type Info } from "../options";

/** Where on screen the row being described sits, so the card can be put beside it. */
export interface Anchor {
  top: number;
  bottom: number;
  left: number;
}

const WIDTH = 340;
const GAP = 10;

/**
 * What the option catalogue says about the option under the pointer.
 *
 * Placed against the row rather than following the cursor, and clamped to the viewport, so that a
 * row near an edge does not push the card off screen. It never takes the pointer, since it exists
 * only while the pointer is somewhere else.
 */
export function OptionDetail({ info, anchor }: { info: Info; anchor: Anchor }) {
  // Beside the list where there is room, otherwise flipped to the other side of it.
  const room = anchor.left - WIDTH - GAP;
  const left = room > GAP ? room : Math.min(anchor.left + GAP, window.innerWidth - WIDTH - GAP);
  const top = Math.max(GAP, Math.min(anchor.top, window.innerHeight - 220));

  return (
    <div className="detail" style={{ top, left, width: WIDTH }}>
      <p className="title">{info.title}</p>
      <p className="what">{info.description}</p>
      {info.variants.map((variant) => (
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
