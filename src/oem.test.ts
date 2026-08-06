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
    // The mobile naming of the same bit is not this radio's reading of it, so it is neither kept
    // nor refused: reporting it would count one bit twice, once each way.
    expect(built.refused).toEqual([]);
    expect(built.kept.map((option) => option.part)).toContain("QA04447");
  });

  it("reads a bit set under the other kind's naming as its own", () => {
    // Setting the mobile naming of Geofence sets the one bit both namings read, so on a portable
    // the bit is kept under the portable name and the mobile one is not reported at all.
    const mobileOnly = OPTIONS.find((option) => option.part === "GA01202")!;
    const code = withOption(empty(), mobileOnly, true);
    const built = rebuild(code, PORTABLE, OPTIONS);
    expect(built.refused).toEqual([]);
    expect(built.kept.map((option) => option.part)).toContain("QA04447");
    expect(built.dropped).toEqual([]);
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
    // Digit 2 goes entirely, for both reasons at once. The band flags that are on there belong to
    // the refreshed hardware's layout, which this radio does not use; the five-bit field it does
    // use holds 31, which names no band. So every bit is either refused or unclaimed.
    expect(built.dropped.filter((held) => held.character === 2)).toEqual(
      [0, 1, 2, 3, 4, 5].map((bit) => ({ character: 2, bit })),
    );
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
   *
   * Known has to mean known *for this radio*. `Y00080-000000-1-001000-000000` holds the ETSI
   * regulatory region, which the APX 6000 below does not carry, so the code that survives an
   * APX 8000H does not survive it.
   */
  it("reproduces a code that holds nothing but options the model carries", () => {
    for (const written of ["000080-000000-3-000000-000000", "Y00080-000000-1-001000-000000"]) {
      const code = parse(written).code;
      const built = rebuild(code, radioOf("H91TGD9PW9AN"), OPTIONS);
      expect(same(built.code, code), written).toBe(true);
      expect(built.dropped, written).toEqual([]);
    }
  });

  /**
   * The same code against a radio that does not carry one of its options. This is what the model
   * buys: `QA08157` carries no guard at all, so the guard alone would offer it to every radio.
   */
  it("drops an option the model's family does not list, guard or no guard", () => {
    const etsi = OPTIONS.find((option) => option.part === "QA08157")!;
    expect(etsi.guard).toEqual([]);
    const code = parse("Y00080-000000-1-001000-000000").code;
    const built = rebuild(code, PORTABLE, OPTIONS);
    expect(built.refused.map((option) => option.part)).toContain("QA08157");
    expect(built.dropped).toContainEqual({ character: etsi.character, bit: etsi.lsb });
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
