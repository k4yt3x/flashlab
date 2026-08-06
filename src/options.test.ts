import { describe, expect, it } from "vitest";

import { empty, full, parse } from "./flashcode";
import {
  OPTIONS,
  type Option,
  UNKNOWN,
  carriedBy,
  groups,
  isOn,
  namedBits,
  optionsAt,
  optionsOn,
  radioOf,
  withOption,
} from "./options";

/** The first option matching a part number and, when several share it, a predicate. */
function option(part: string, where: (option: Option) => boolean = () => true): Option {
  const found = OPTIONS.find((held) => held.part === part && where(held));
  if (!found) {
    throw new Error(`the table should hold ${part}`);
  }
  return found;
}

const PORTABLE = radioOf("H98UCF9PW6AN");
const MOBILE = radioOf("M37TXS9PW1AN");

describe("the table", () => {
  it("places every option inside a six-bit character of a twenty-four character code", () => {
    for (const held of OPTIONS) {
      expect(held.character).toBeGreaterThanOrEqual(0);
      expect(held.character).toBeLessThan(24);
      expect(held.lsb).toBeGreaterThanOrEqual(0);
      expect(held.lsb + held.width).toBeLessThanOrEqual(6);
      expect(held.value).toBeGreaterThan(0);
      expect(held.value).toBeLessThan(1 << held.width);
    }
  });

  it("gives every option a distinct id", () => {
    expect(new Set(OPTIONS.map((held) => held.id)).size).toBe(OPTIONS.length);
  });

  it("describes every option it lists", () => {
    for (const held of OPTIONS) {
      expect(held.info, held.part).toBeDefined();
      expect(held.info!.description.length).toBeGreaterThan(10);
      expect(held.info!.variants.length).toBeGreaterThan(0);
    }
  });

  it("names a configuration only where there are two to tell apart", () => {
    for (const held of OPTIONS) {
      const named = held.info!.variants.filter((variant) => variant.for !== "");
      expect(named.length === 0 || named.length === held.info!.variants.length).toBe(true);
      if (held.info!.variants.length === 1) {
        expect(held.info!.variants[0]!.for).toBe("");
      }
    }
  });

  it("only ever cites part numbers the catalogue knows in a requirement or a conflict", () => {
    const catalogued = new Set(OPTIONS.map((held) => held.part));
    // Not every cited number is one this table places in a bit, so a stray is expected; what would
    // not be is a citation of something malformed.
    for (const held of OPTIONS) {
      for (const variant of held.info!.variants) {
        for (const cited of [...variant.requires, ...variant.conflicts]) {
          expect(cited, `${held.part} cites ${cited}`).toMatch(/^[A-Z0-9]{3,8}$/);
        }
      }
    }
    expect(catalogued.size).toBeGreaterThan(100);
  });

  it("names fewer bits than the code has, which is the room to experiment in", () => {
    expect(namedBits().size).toBeLessThan(24 * 6);
  });
});

describe("reading a model number", () => {
  it("takes the first character as the radio's kind", () => {
    expect(radioOf("H98UCF9PW6AN").mobile).toBe(false);
    expect(radioOf("M37TXS9PW1AN").mobile).toBe(true);
    expect(radioOf("L30JSS9PW1AN").mobile).toBe(true);
    expect(radioOf("").mobile).toBeNull();
    expect(radioOf("Z00000000000").mobile).toBeNull();
  });

  it("recognises the two high power 8500s and the single band 8/900s", () => {
    expect(radioOf("M37TXS9PW1AN").is8500hp).toBe(true);
    expect(radioOf("M37TXS9PW1CN").is8500hp).toBe(true);
    expect(radioOf("M37TSS9PW1AN").is8500hp).toBe(false);
    expect(radioOf("M22VRS9PW1CN").singleBand8900).toBe(true);
    expect(radioOf("M37TXS9PW1AN").singleBand8900).toBe(false);
  });
});

describe("which radios carry an option", () => {
  it("names the same bit differently on a mobile and a portable", () => {
    const geofence = OPTIONS.filter((held) => held.name === "APX Geofence");
    expect(geofence.map((held) => held.part).sort()).toEqual(["GA01202", "QA04447"]);
    for (const held of geofence) {
      expect(held.character).toBe(0);
      expect(held.lsb).toBe(5);
    }
    expect(carriedBy(option("GA01202"), MOBILE)).toBe(true);
    expect(carriedBy(option("GA01202"), PORTABLE)).toBe(false);
    expect(carriedBy(option("QA04447"), PORTABLE)).toBe(true);
    expect(carriedBy(option("QA04447"), MOBILE)).toBe(false);
  });

  it("leaves a model-dependent option unresolved when no model is given", () => {
    expect(carriedBy(option("GA01202"), UNKNOWN)).toBeNull();
    expect(carriedBy(option("QA04447"), UNKNOWN)).toBeNull();
  });

  it("resolves an option no guard applies to for any radio", () => {
    const ungated = OPTIONS.find((held) => held.guard.length === 0);
    expect(ungated).toBeDefined();
    expect(carriedBy(ungated!, UNKNOWN)).toBe(true);
    expect(carriedBy(ungated!, PORTABLE)).toBe(true);
  });

  it("separates the two 8500 high power band namings", () => {
    expect(carriedBy(option("GA00341"), MOBILE)).toBe(false);
    expect(carriedBy(option("GA00342", (held) => held.width === 1), MOBILE)).toBe(true);
    expect(carriedBy(option("GA00341"), radioOf("M37TSS9PW1AN"))).toBe(true);
  });
});

describe("reading options out of a code", () => {
  it("finds the three options a code with those bits set names", () => {
    // `Y00080-000000-1-001000-000000` is Geofence, the Advanced System Key and ETSI.
    const { code } = parse("Y00080-000000-1-001000-000000");
    const on = optionsOn(code).map((held) => held.part);
    expect(on).toContain("QA04447");
    expect(on).toContain("QA01648");
    expect(on).toContain("QA08157");
  });

  it("does not report a multi-bit option whose field holds some other value", () => {
    // Every bit set leaves the primary band field at 31, which names no band at all.
    const bands = groups().find((group) => group.character === 2 && group.width === 5);
    expect(bands?.chooser).toBe(true);
    for (const held of bands!.options) {
      expect(isOn(full(), held)).toBe(false);
    }
  });

  it("reports the flags that do sit inside an all-set character", () => {
    // The 7/800 MHz flag is bits 3-4 holding 3, which every bit being set satisfies.
    expect(isOn(full(), option("QA00569", (held) => held.width === 2))).toBe(true);
  });
});

describe("editing through the option list", () => {
  it("turns an option on and off without disturbing its neighbours", () => {
    const geofence = option("QA04447");
    const on = withOption(empty(), geofence, true);
    expect(isOn(on, geofence)).toBe(true);
    expect(on[0]).toBe(1 << 5);

    const off = withOption(full(), geofence, false);
    expect(isOn(off, geofence)).toBe(false);
    // Every other bit of character 0, and every other character, is untouched.
    expect(off[0]).toBe(0b011111);
    expect(off.slice(1)).toEqual(full().slice(1));
  });

  it("subtracts one option from an all-set code and leaves the other 143 bits alone", () => {
    const target = option("QA08157");
    const before = full();
    const after = withOption(before, target, false);
    expect(after[14]).toBe(62);
    // Every other character is untouched, which is the whole point of subtracting.
    expect(after.filter((_, at) => at !== 14)).toEqual(before.filter((_, at) => at !== 14));
    // And only options reading that one bit come off.
    for (const held of OPTIONS) {
      if (isOn(before, held) && !isOn(after, held)) {
        expect(held.character).toBe(14);
        expect(held.lsb).toBe(0);
      }
    }
  });

  it("chooses one value of a chooser at a time", () => {
    const vhf = option("QA00570", (held) => held.width === 5);
    const uhf = option("QA00571", (held) => held.width === 5);
    const withVhf = withOption(empty(), vhf, true);
    expect(isOn(withVhf, vhf)).toBe(true);
    expect(isOn(withVhf, uhf)).toBe(false);
    const withUhf = withOption(withVhf, uhf, true);
    expect(isOn(withUhf, vhf)).toBe(false);
    expect(isOn(withUhf, uhf)).toBe(true);
  });
});

describe("grouping", () => {
  it("gathers the primary band values into one chooser", () => {
    const bands = groups().filter((group) => group.character === 2);
    const chooser = bands.find((group) => group.chooser);
    expect(chooser).toBeDefined();
    expect(chooser!.width).toBe(5);
    expect(chooser!.lsb).toBe(0);
    // Eight bands across the two namings, none of them repeating a value within a naming.
    expect(chooser!.options.length).toBeGreaterThan(8);
  });

  it("reports both names of a bit two kinds of radio share", () => {
    const shared = optionsAt(0, 5);
    expect(shared.map((held) => held.part).sort()).toEqual(["GA01202", "QA04447"]);
  });

  it("reports every option that reads an overlapping bit", () => {
    // Character 2 bit 4 is read by the primary band chooser and by both band flags.
    const overlapping = optionsAt(2, 4);
    expect(overlapping.some((held) => held.width === 5)).toBe(true);
    expect(overlapping.some((held) => held.width === 2)).toBe(true);
  });
});
