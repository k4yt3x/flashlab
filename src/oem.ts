/**
 * What a conventional FLASHcode encoder would produce.
 *
 * An OEM encoder builds a code from a chosen model and a set of options, starting from an empty
 * one. That is a different operation from editing a code, and it loses anything it cannot name,
 * which is why this is a comparison rather than a mode the editor runs in.
 */

import { type Code, empty } from "./flashcode";
import { type Option, type Radio, carriedBy, isOn, readableOn, withOption } from "./options";

export interface Rebuilt {
  code: number[];
  /** Options that are on and survive, because the radio carries them. */
  kept: Option[];
  /** Options that are on but which an OEM encoder would not have offered for this model. */
  refused: Option[];
  /**
   * Bits that are set now and would not be afterwards.
   *
   * Two different things land here. A bit no option in the table names at all, and a bit belonging
   * to a multi-bit field whose current value names no option, which an encoder that only writes
   * known values can no more reproduce than a bit it has never heard of. Both are lost the same
   * way, so both are reported the same way.
   */
  dropped: { character: number; bit: number }[];
}

/**
 * Rebuild a code the way an OEM encoder would: from zero, from the options a model may have.
 *
 * An unresolved model counts as carrying the option, so that leaving the model box empty compares
 * against the naming rules only rather than silently dropping half the table.
 */
export function rebuild(code: Code, radio: Radio, options: readonly Option[]): Rebuilt {
  const kept: Option[] = [];
  const refused: Option[] = [];
  let built = empty();

  for (const option of options) {
    if (!isOn(code, option)) {
      continue;
    }
    // A reading belonging to the other band layout is not something this radio was refused, it is
    // not a description of these bits at all. Counting it as refused reported far more than the
    // list shows, and an encoder for this radio would never have considered it.
    if (radio.carries && !readableOn(option, radio)) {
      continue;
    }
    if (carriedBy(option, radio) === false) {
      refused.push(option);
      continue;
    }
    kept.push(option);
    built = withOption(built, option, true);
  }

  const dropped: { character: number; bit: number }[] = [];
  for (let character = 0; character < code.length; character += 1) {
    for (let bit = 0; bit < 6; bit += 1) {
      const before = ((code[character] ?? 0) >> bit) & 1;
      const after = ((built[character] ?? 0) >> bit) & 1;
      if (before === 1 && after === 0) {
        dropped.push({ character, bit });
      }
    }
  }

  return { code: built, kept, refused, dropped };
}
