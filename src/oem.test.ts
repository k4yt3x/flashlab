import { describe, expect, it } from "vitest";

import { empty, full, parse, same } from "./flashcode";
import { rebuild } from "./oem";
import { OPTIONS, UNKNOWN, isOn, namedBits, optionsOn, radioOf, withOption } from "./options";

const PORTABLE = radioOf("H98UCF9PW6AN");

describe("rebuilding the way an OEM encoder would", () => {
  it("keeps a code that only holds options the model carries", () => {
    const geofence = OPTIONS.find((option) => option.part === "QA04447")!;
    const code = withOption(empty(), geofence, true);
    const built = rebuild(code, PORTABLE, OPTIONS);
    expect(same(built.code, code)).toBe(true);
    expect(built.dropped).toEqual([]);
    // The mobile naming of the same bit is refused, but the bit survives under the portable one,
    // which is why a refusal is not by itself a loss.
    expect(built.refused.map((option) => option.part)).toEqual(["GA01202"]);
    expect(built.kept.map((option) => option.part)).toContain("QA04447");
  });

  it("drops an option the model does not carry", () => {
    // The mobile naming of the same bit, on a portable.
    const mobileOnly = OPTIONS.find((option) => option.part === "GA01202")!;
    const code = withOption(empty(), mobileOnly, true);
    const built = rebuild(code, PORTABLE, OPTIONS);
    expect(built.refused.map((option) => option.part)).toContain("GA01202");
    // The portable naming of that bit survives, so the bit itself stays.
    expect(built.kept.map((option) => option.part)).toContain("QA04447");
  });

  it("drops every bit it cannot account for, which is what makes subtraction impossible", () => {
    const built = rebuild(full(), PORTABLE, OPTIONS);
    const named = namedBits();
    expect(built.dropped.length).toBeGreaterThan(0);
    // No option names digit 12, so all six of its bits are lost.
    expect(built.code[12]).toBe(0);
    for (let bit = 0; bit < 6; bit += 1) {
      expect(built.dropped).toContainEqual({ character: 12, bit });
    }
    // Bits are also lost out of a named field holding a value no option claims. Every bit set
    // leaves the secondary band chooser at digit 3 holding 31, which is not one of the bands, and
    // bits 0 and 1 there are covered by nothing else, so they simply go.
    for (const bit of [0, 1]) {
      expect(named.has(3 * 6 + bit)).toBe(true);
      expect(built.dropped).toContainEqual({ character: 3, bit });
    }
    // Digit 2's chooser is equally unclaimed, but its bits survive because the individual band
    // flags cover the same ground and those are on. Losing a field is not the same as losing bits.
    expect(built.dropped.filter((held) => held.character === 2)).toEqual([]);
  });

  it("cannot reproduce a code built by subtracting from a full one", () => {
    // An all-set code minus a few options does not survive a rebuild that only ever adds.
    const geofence = OPTIONS.find((option) => option.part === "QA04447")!;
    const code = withOption(full(), geofence, false);
    const built = rebuild(code, PORTABLE, OPTIONS);
    expect(same(built.code, code)).toBe(false);
    expect(built.dropped.length).toBeGreaterThan(0);
  });

  /**
   * The panel claims this reproduces what a conventional encoder would emit, so the claim is held
   * to something: a code whose whole option set is known comes back byte for byte.
   */
  it("reproduces a code that holds nothing but options it can name", () => {
    for (const written of ["000080-000000-3-000000-000000", "Y00080-000000-1-001000-000000"]) {
      const code = parse(written).code;
      const built = rebuild(code, PORTABLE, OPTIONS);
      expect(same(built.code, code), written).toBe(true);
      expect(built.dropped, written).toEqual([]);
    }
  });

  it("counts an option as carried when no model was given", () => {
    const code = withOption(empty(), OPTIONS.find((option) => option.part === "GA01202")!, true);
    expect(rebuild(code, UNKNOWN, OPTIONS).refused).toEqual([]);
  });

  it("only ever reports options that were on to begin with", () => {
    const code = parse("1ALWgt-$%5FRb-4-2CNYjv-&7HTdq").code;
    const built = rebuild(code, PORTABLE, OPTIONS);
    const on = new Set(optionsOn(code).map((option) => option.id));
    for (const option of [...built.kept, ...built.refused]) {
      expect(on.has(option.id)).toBe(true);
    }
    for (const option of built.kept) {
      expect(isOn(built.code, option)).toBe(true);
    }
  });
});
