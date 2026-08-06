/**
 * The FLASHcode itself: the string, the bits under it, and the check digit between them.
 *
 * A FLASHcode is a base-64 bit vector. Twenty-four characters of six bits each, written in four
 * groups of six with a check digit wedged in after the second group. Nothing here knows what any
 * bit means; that is `options.ts`.
 */

/**
 * The 64 characters a FLASHcode is written in.
 *
 * Base-64 with every ambiguous glyph removed, so there is no `I`, no `O`, no `i`, no `l` and no
 * `o`. A character's value is its index here.
 */
export const ALPHABET = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz#(+$)&%";

/** Characters a code carries, not counting the check digit or the separators. */
export const LENGTH = 24;

/**
 * Characters a shorter, older code carries. A short one is accepted and zero-padded to the full
 * width.
 */
export const LEGACY_LENGTH = 12;

/** Bits in one character. Values run 0 to 63, so bits 6 and 7 do not exist. */
export const BITS = 6;

/** One FLASHcode, as the twenty-four six-bit values that are the only real state. */
export type Code = readonly number[];

/** A code with every bit clear. */
export function empty(): number[] {
  return new Array<number>(LENGTH).fill(0);
}

/** A code with every bit set, which is where subtracting your way to an option set starts. */
export function full(): number[] {
  return new Array<number>(LENGTH).fill(63);
}

/** The value of one FLASHcode character, or -1 if it is not one. */
function valueOf(character: string): number {
  return ALPHABET.indexOf(character);
}

function digitSum(value: number): number {
  let sum = 0;
  for (let rest = value; rest > 0; rest = Math.floor(rest / 10)) {
    sum += rest % 10;
  }
  return sum;
}

/**
 * The check digit of a code, which is a Luhn variant taken over the six-bit values rather than over
 * decimal digits.
 *
 * Even positions contribute the digit sum of twice the value, odd positions the digit sum of the
 * value, and the digit is whatever brings the total to a multiple of ten. A legacy code checks over
 * its twelve characters and a modern one over all twenty-four, which is why the width is passed in.
 */
export function checkDigit(code: Code, width: number = LENGTH): number {
  let total = 0;
  for (let at = 0; at < width; at += 1) {
    const value = code[at] ?? 0;
    total += at % 2 === 0 ? digitSum(value * 2) : digitSum(value);
  }
  return (10 - (total % 10)) % 10;
}

/** What a code turned out to be, and anything the reader had to forgive to get there. */
export interface Parsed {
  code: number[];
  /** How many characters were written, so that a legacy code can be reported as one. */
  width: number;
  /** The check digit as written, when one was, so a wrong one can be shown rather than hidden. */
  stated: number | null;
  /** The check digit the payload actually computes to. */
  expected: number;
}

export class ParseError extends Error {}

/**
 * Read a FLASHcode.
 *
 * Every written form is accepted: the modern `AAAAAA-BBBBBB-C-DDDDDD-EEEEEE`, the older
 * `AAAAAA-BBBBBB-C` which pads with zeros, either of those without separators, and a bare run of 24
 * characters with no check digit at all.
 *
 * **A wrong check digit is not an error.** It comes back in `stated` beside the `expected` one for
 * the caller to report. Refusing would make the one code a lab user most wants to look at, the one
 * they were handed that does not validate, the one code this cannot open.
 */
export function parse(text: string): Parsed {
  const characters = [...text].filter((character) => character !== "-" && !/\s/.test(character));

  let width: number;
  let checkAt: number;
  switch (characters.length) {
    case LENGTH + 1:
      [width, checkAt] = [LENGTH, LEGACY_LENGTH];
      break;
    case LEGACY_LENGTH + 1:
      [width, checkAt] = [LEGACY_LENGTH, LEGACY_LENGTH];
      break;
    // A payload with no check digit at all, which is what falls out of a raw bit editor.
    case LENGTH:
      [width, checkAt] = [LENGTH, -1];
      break;
    case LEGACY_LENGTH:
      [width, checkAt] = [LEGACY_LENGTH, -1];
      break;
    default:
      throw new ParseError(
        `A code is 12 or 24 digits, with or without a check digit, not ${characters.length}`,
      );
  }

  const code = empty();
  let stated: number | null = null;
  characters.forEach((character, at) => {
    const value = valueOf(character);
    if (value < 0) {
      throw new ParseError(`${character} is not in the FLASHcode alphabet`);
    }
    if (at === checkAt) {
      stated = value;
    } else {
      code[at < checkAt || checkAt < 0 ? at : at - 1] = value;
    }
  });

  return { code, width, stated, expected: checkDigit(code, width) };
}

/**
 * What is worth saying about a code that was read, but not cleanly.
 *
 * Here rather than at the place a code is typed, because a code also arrives in a link, and a link
 * is the harder case: `format` recomputes the check digit, so by the time the code is on screen the
 * one it was written with is gone. A reader handed a code that does not validate is told so however
 * it reached them.
 */
export function noteOn(read: Parsed): string | null {
  if (read.stated !== null && read.stated !== read.expected) {
    return `Check digit is ${read.stated}, should be ${read.expected}. The code was read anyway.`;
  }
  return read.width === LEGACY_LENGTH ? "Read as a legacy 12-digit code, zero padded." : null;
}

/**
 * Read twenty-four values written as numbers, which is the shape a code takes when it is dumped as
 * raw bytes rather than printed as a string. Hex may be `0x`-prefixed or bare.
 */
export function parseValues(text: string, radix: number): number[] {
  const written = text.trim().split(/[\s,]+/).filter(Boolean);
  if (written.length !== LENGTH && written.length !== LEGACY_LENGTH) {
    throw new ParseError(`Expected ${LEGACY_LENGTH} or ${LENGTH} values, got ${written.length}`);
  }
  const code = empty();
  written.forEach((word, at) => {
    const value = Number.parseInt(word.replace(/^0[xX]/, ""), radix);
    if (!Number.isInteger(value) || value < 0 || value > 63) {
      throw new ParseError(`${word} is not a six-bit value`);
    }
    code[at] = value;
  });
  return code;
}

/**
 * Write a code out as the string it is normally printed as, check digit and all.
 *
 * The digit is always recomputed, and is written after the second group.
 */
export function format(code: Code): string {
  let out = "";
  for (let at = 0; at < LENGTH; at += 1) {
    if (at === LEGACY_LENGTH) {
      out += `-${ALPHABET[checkDigit(code)]}`;
    }
    if (at > 0 && at % 6 === 0) {
      out += "-";
    }
    out += ALPHABET[code[at] ?? 0];
  }
  return out;
}

/** Whether one bit of one character is set. */
export function bitSet(code: Code, character: number, bit: number): boolean {
  return (((code[character] ?? 0) >> bit) & 1) === 1;
}

/** The same code with one bit changed, leaving every other bit of every character alone. */
export function withBit(code: Code, character: number, bit: number, set: boolean): number[] {
  const next = [...code];
  const mask = 1 << bit;
  next[character] = set ? (next[character] ?? 0) | mask : (next[character] ?? 0) & ~mask;
  return next;
}

/** The value a run of bits within one character holds. */
export function fieldValue(code: Code, character: number, lsb: number, width: number): number {
  return ((code[character] ?? 0) >> lsb) & ((1 << width) - 1);
}

/** The same code with a run of bits set to a value, leaving the rest of the character alone. */
export function withField(
  code: Code,
  character: number,
  lsb: number,
  width: number,
  value: number,
): number[] {
  const next = [...code];
  const mask = ((1 << width) - 1) << lsb;
  next[character] = (((next[character] ?? 0) & ~mask) | ((value << lsb) & mask)) & 63;
  return next;
}

/** Whether two codes hold the same bits. */
export function same(a: Code, b: Code): boolean {
  return a.length === b.length && a.every((value, at) => value === b[at]);
}
