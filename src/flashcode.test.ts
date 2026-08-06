import { describe, expect, it } from "vitest";

import {
  ALPHABET,
  LEGACY_LENGTH,
  LENGTH,
  ParseError,
  checkDigit,
  empty,
  fieldValue,
  format,
  full,
  parse,
  parseValues,
  withBit,
  withField,
} from "./flashcode";

/** Codes that exercise the reader: both extremes, a spread of the alphabet, and two known sets. */
const SAMPLES = [
  "1ALWgt-$%5FRb-4-2CNYjv-&7HTdq",
  "%%%%%%-%%%%%%-4-%%%%%%-%%%%%%",
  "000000-000000-0-000000-000000",
  // The Advanced System Key alone.
  "000080-000000-3-000000-000000",
  // The Advanced System Key, Geofence and the ETSI regulatory region together.
  "Y00080-000000-1-001000-000000",
];

describe("the alphabet", () => {
  it("is 64 characters with every ambiguous glyph left out", () => {
    expect(ALPHABET).toHaveLength(64);
    for (const absent of ["I", "O", "i", "l", "o"]) {
      expect(ALPHABET).not.toContain(absent);
    }
  });
});

describe("parsing", () => {
  it("round trips every real code", () => {
    for (const written of SAMPLES) {
      const { code, stated, expected } = parse(written);
      expect(stated).toBe(expected);
      expect(format(code)).toBe(written);
    }
  });

  it("takes a code with the separators left out", () => {
    const withSeparators = parse(SAMPLES[0]!).code;
    const without = parse(SAMPLES[0]!.replaceAll("-", "")).code;
    expect(without).toEqual(withSeparators);
  });

  it("pads a legacy code and reports the width it was written at", () => {
    const { code, width, stated, expected } = parse("000080-000000-3");
    expect(width).toBe(LEGACY_LENGTH);
    expect(stated).toBe(expected);
    expect(code[4]).toBe(8);
    expect(code.slice(LEGACY_LENGTH).every((value) => value === 0)).toBe(true);
    expect(format(code)).toBe("000080-000000-3-000000-000000");
  });

  it("takes a payload with no check digit at all", () => {
    const { code, stated } = parse("%".repeat(LENGTH));
    expect(stated).toBeNull();
    expect(code).toEqual(full());
  });

  it("reports a wrong check digit rather than refusing the code", () => {
    const { code, stated, expected } = parse("000080-000000-9-000000-000000");
    expect(stated).toBe(9);
    expect(expected).toBe(3);
    // The payload still came through, which is the whole point of not throwing.
    expect(code[4]).toBe(8);
  });

  it("refuses a character outside the alphabet, and a wrong length", () => {
    expect(() => parse("00008O-000000-3-000000-000000")).toThrow(ParseError);
    expect(() => parse("0008-3")).toThrow(ParseError);
  });

  it("reads the twenty-four values written as numbers", () => {
    const hex = parseValues("3f ".repeat(LENGTH), 16);
    expect(hex).toEqual(full());
    expect(parseValues("0x3F,".repeat(LENGTH).slice(0, -1), 16)).toEqual(full());
    expect(() => parseValues("64 ".repeat(LENGTH), 10)).toThrow(ParseError);
  });
});

describe("the check digit", () => {
  it("brings an all-zero code to zero and an all-set code to four", () => {
    expect(checkDigit(empty())).toBe(0);
    expect(checkDigit(full())).toBe(4);
    expect(format(full())).toBe("%%%%%%-%%%%%%-4-%%%%%%-%%%%%%");
  });

  it("is taken over the written width, so a legacy code checks over twelve", () => {
    const { code } = parse("000080-000000-3");
    expect(checkDigit(code, LEGACY_LENGTH)).toBe(3);
  });
});

describe("editing", () => {
  it("changes one bit and leaves every other bit alone", () => {
    const before = full();
    const after = withBit(before, 7, 3, false);
    expect(after[7]).toBe(0b110111);
    expect(after.filter((_, at) => at !== 7)).toEqual(before.filter((_, at) => at !== 7));
  });

  it("writes a value into a run of bits without disturbing its neighbours", () => {
    // Character 2 holds the primary band enum at bits 0-4 under the 900 MHz flag at bit 5.
    const after = withField(full(), 2, 0, 5, 2);
    expect(after[2]).toBe(0b100010);
    expect(fieldValue(after, 2, 0, 5)).toBe(2);
    expect(fieldValue(after, 2, 5, 1)).toBe(1);
  });

  it("keeps a character within six bits", () => {
    expect(withField(empty(), 0, 0, 6, 255)[0]).toBe(63);
  });
});

describe("the two starting points", () => {
  it("are a code of every bit clear and a code of every bit set", () => {
    expect(format(empty())).toBe("000000-000000-0-000000-000000");
    expect(parse(format(full())).code).toEqual(full());
    expect(full().every((value) => value === 63)).toBe(true);
  });
});
