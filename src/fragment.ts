/**
 * The page's shareable state, carried in the address bar.
 *
 * A fragment is never sent to a server, so this is the one place the whole state can live without
 * anything leaving the browser.
 *
 * The separator has to be a character the FLASHcode alphabet does not hold, which rules out the
 * obvious ones: `&` is in the alphabet and would be read as a field separator, `+` is in it and a
 * query parser would decode it as a space, and `%` is in it and starts an escape. `;` and `=` are
 * outside the alphabet entirely, so the code can be written as it reads and the fields after it
 * cannot be confused with it.
 */

import { type Code, format, parse } from "./flashcode";

/** What a link can carry. */
export interface Shared {
  /** The code, or null where the fragment named none this could read. */
  code: number[] | null;
  model: string;
}

const EMPTY: Shared = { code: null, model: "" };

/**
 * Percent decoding that gives up rather than throwing.
 *
 * Used only on the fields this encodes itself, never on the code. See `readCode`.
 */
function loosely(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * The code a fragment names, read as written before read as encoded.
 *
 * The alphabet holds `%`, so a code can contain what looks like a percent escape by accident:
 * `1ALWgt-$%5FRb-4-2CNYjv-&7HTdq` has `%5F` in it, and decoding that first would silently turn it
 * into `_` and lose the code. Decoding therefore has to be the fallback rather than the first move,
 * and `parse` is what tells the two apart, since it holds the text to a length and an alphabet.
 */
function readCode(written: string): number[] | null {
  for (const candidate of [written, loosely(written)]) {
    const text = candidate.trim();
    if (!text) {
      continue;
    }
    try {
      return parse(text).code;
    } catch {
      // Not that reading; try the other.
    }
  }
  return null;
}

/**
 * Read a fragment.
 *
 * The first field is the code, written plainly. Anything after it is `key=value`. A fragment
 * holding nothing but a code is the older form and still reads, so links shared before this
 * existed keep working.
 *
 * Nothing here throws: a fragment is user input arriving before the first render, and a bad one
 * must cost its own contents rather than the page.
 */
export function read(hash: string): Shared {
  try {
    const [first = "", ...rest] = hash.replace(/^#/, "").split(";");

    const fields = new Map<string, string>();
    for (const field of rest) {
      const at = field.indexOf("=");
      if (at > 0) {
        fields.set(field.slice(0, at), loosely(field.slice(at + 1)).trim());
      }
    }

    return { code: readCode(first), model: fields.get("model") ?? "" };
  } catch {
    return EMPTY;
  }
}

/**
 * Write a fragment.
 *
 * A field it has nothing to say about is left out, so a page with no model produces the bare code
 * it always did.
 */
export function write(code: Code, model: string): string {
  const fields = [format(code)];
  if (model.trim()) {
    fields.push(`model=${encodeURIComponent(model.trim())}`);
  }
  return fields.join(";");
}
