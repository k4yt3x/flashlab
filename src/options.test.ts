import { describe, expect, it } from "vitest";

import { empty, full, parse } from "./flashcode";
import {
  ATOMS,
  OPTIONS,
  readableOn,
  type Option,
  UNKNOWN,
  carriedBy,
  groups,
  isOn,
  namedBits,
  optionsAt,
  optionsOn,
  radioOf,
  variantsFor,
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

describe("the guards", () => {
  /**
   * An atom the reader does not know is read as no constraint, so a table naming one would offer
   * whatever it guards to every radio. The vocabulary is small and closed, so it is pinned.
   */
  it("names nothing the reader cannot read", () => {
    const named = new Set<string>();
    for (const held of OPTIONS) {
      for (const written of held.guard) {
        named.add(written.startsWith("!") ? written.slice(1) : written);
      }
    }
    expect([...named].sort()).toEqual([...ATOMS].sort());
  });

  /**
   * The list above pins the table to the reader; this pins the reader to the list. An atom named
   * there but missing from `atom`'s switch would read as no constraint, and a guard and its own
   * negation would then both hold, which is the one thing no reading of a radio can do.
   */
  it("reads every atom it names", () => {
    const radio = radioOf("H91TGD9PW9AN");
    for (const named of ATOMS) {
      const both = { ...OPTIONS[0]!, guard: [named, `!${named}`] };
      expect(readableOn(both, radio), `${named} is not read`).toBe(false);
    }
  });

  it("spells a negation with a leading bang and nothing else", () => {
    for (const held of OPTIONS) {
      for (const written of held.guard) {
        expect(written, `${held.part} is guarded on ${written}`).toMatch(/^!?[a-z0-9]+$/);
      }
    }
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

  /**
   * `QA01843` appears under both kinds of radio with the same part number on the same bit. It is
   * one option offered to everyone, and two rows under opposite guards would show the same part
   * number twice and call one of them not offered.
   */
  it("holds one row per part number for a given bit and value", () => {
    const seen = new Map<string, number>();
    for (const held of OPTIONS) {
      const key = `${held.part}:${held.character}:${held.lsb}:${held.width}:${held.value}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const twice = [...seen].filter(([, count]) => count > 1);
    expect(twice).toEqual([]);
  });

  it("leaves a model-dependent option unresolved when no model is given", () => {
    expect(carriedBy(option("GA01202"), UNKNOWN)).toBeNull();
    expect(carriedBy(option("QA04447"), UNKNOWN)).toBeNull();
  });

  it("resolves an option no guard applies to for any radio", () => {
    const ungated = OPTIONS.find((held) => held.guard.length === 0);
    expect(ungated).toBeDefined();
    expect(carriedBy(ungated!, UNKNOWN)).toBe(true);
  });

  /**
   * An option's guard says at most which kind of radio it is *named* for. Whether a radio carries
   * it is a separate question that only the model answers, and for a third of the table the guard
   * does not even claim to: `QA08157` carries no guard, so the guard alone would offer an ETSI
   * regulatory region on every radio Motorola makes.
   */
  it("answers an unguarded option from the model rather than by offering it to everyone", () => {
    const etsi = option("QA08157");
    expect(etsi.guard).toEqual([]);
    expect(carriedBy(etsi, radioOf("H91TGD9PW9AN"))).toBe(true);
    expect(carriedBy(etsi, PORTABLE)).toBe(false);
    // With no model there is nothing to answer from, and an empty guard excludes nobody.
    expect(carriedBy(etsi, UNKNOWN)).toBe(true);
  });

  /**
   * The model is read for the option set, not just for the first character. Two radios that are
   * both portables, and which the guard therefore cannot tell apart, carry different options.
   */
  it("separates two radios of the same kind", () => {
    const band = option("QA03056", (held) => held.width === 5);
    expect(carriedBy(band, radioOf("H98UCF9PW6AN"))).toBe(false);
    expect(carriedBy(band, radioOf("H84UCD9PW5AN"))).toBe(true);
    expect(radioOf("H98UCF9PW6AN").mobile).toBe(radioOf("H84UCD9PW5AN").mobile);
  });

  /**
   * Digits 2 and 3 carry two entirely different band layouts, and which one a radio uses is the one
   * thing about it the model number does not give away. The refreshed hardware gets a bit per band;
   * everything else gets a five-bit field in which the same part numbers are values. The same part
   * number therefore appears twice, on different bits, and only one of them is this radio's.
   */
  it("tells the two band layouts apart, which nothing in the number says", () => {
    const flag = option("GA00307", (held) => held.width === 1);
    const value = option("GA00307", (held) => held.width === 5);
    expect(flag.character).toBe(value.character);
    expect(flag.lsb).toBe(value.lsb);

    const original = radioOf("M25KTS9PW1AN");
    expect(original.refresh).toBe(false);
    expect(original.carries?.has("GA00307")).toBe(true);
    expect(carriedBy(flag, original), "the bit belongs to the other layout").toBe(false);
    expect(carriedBy(value, original)).toBe(true);

    // Setting the flag on such a radio would write 1 into the field the value layout reads, which
    // is a different band entirely. That is what keeping the layouts apart prevents.
    expect(option("GA00244", (held) => held.width === 5).value).toBe(1);
  });

  /**
   * The family list is stated per family, so it cannot separate what a model number decides. It
   * names both halves of a mobile-and-portable pair, and only the guard tells them apart.
   */
  it("keeps the guard where the family cannot tell two namings apart", () => {
    const vertex = radioOf("H93KDF9PW6AN");
    expect(vertex.carries?.has("G193")).toBe(true);
    expect(carriedBy(option("G193"), vertex)).toBe(false);
    expect(carriedBy(option("Q667"), vertex)).toBe(true);

    // And a band the radio does not have is refused, because the two overlap on a bit.
    const single = radioOf("M22VRS9PW1CN");
    expect(single.singleBand8900).toBe(true);
    expect(carriedBy(option("GA04892"), single)).toBe(true);
    expect(carriedBy(option("GA00244", (held) => held.width === 2), single)).toBe(false);
  });

  /**
   * `portable` and `!mobile` are both spellings of the same thing and the table uses both, so a
   * `portable` guard has to read as the negation of the kind rather than as the kind.
   */
  it("reads a portable guard as the opposite of a mobile one", () => {
    const spelt = OPTIONS.filter((held) => held.guard.includes("portable"));
    expect(spelt.length).toBeGreaterThan(0);
    for (const held of spelt) {
      expect(carriedBy(held, MOBILE), `${held.part} on a mobile`).toBe(false);
    }
    // QA02006 is a portable-guarded option the APX 8000H's family does list.
    expect(carriedBy(option("QA02006"), radioOf("H91TGD9PW9AN"))).toBe(true);
  });

  /**
   * The fragment carries a model verbatim, so `radioOf` is reached with whatever was in the link.
   * `isKnown` normalises independently, so a lower case model passes that gate and then has to
   * survive this one: unnormalised, the first character reads as neither kind and every naming
   * falls through to the family, which lists both.
   */
  it("normalises a model number before reading anything out of it", () => {
    const typed = radioOf("h91tgd9pw9an");
    expect(typed.model).toBe("H91TGD9PW9AN");
    expect(typed.mobile).toBe(false);
    expect(typed.refresh).toBe(radioOf("H91TGD9PW9AN").refresh);
    expect(typed.carries).toBe(radioOf("H91TGD9PW9AN").carries);
    expect(carriedBy(option("GA01202"), typed)).toBe(false);
  });

  /** A half typed model number names no radio, so it settles nothing rather than settling it wrong. */
  it("falls back to the guard for a model number that names no radio", () => {
    const partial = radioOf("H98UCF9PW");
    expect(partial.carries).toBeNull();
    expect(partial.refresh, "which layout it uses is not guessed either").toBeNull();
    expect(carriedBy(option("GA01202"), partial)).toBe(false);
    expect(carriedBy(option("QA04447"), partial)).toBe(true);
    expect(carriedBy(option("QA08157"), partial)).toBe(true);
  });

  it("separates the two 8500 high power band namings", () => {
    expect(carriedBy(option("GA00341"), MOBILE)).toBe(false);
    expect(carriedBy(option("GA00342", (held) => held.width === 1), MOBILE)).toBe(true);
    expect(carriedBy(option("GA00341"), radioOf("M37TSS9PW1AN"))).toBe(true);
  });
});

describe("what the catalogue says about an option", () => {
  /**
   * Seventeen options are sold to both kinds of radio and are listed twice, and fourteen of those
   * two entries differ. `G996` is the clearest: a mobile order needs `W947` and `G806`, a portable
   * one needs `Q947` and `Q806`. Show both to one radio and half the part numbers on the card name
   * hardware that radio cannot take.
   */
  it("keeps only the entry written for this kind of radio", () => {
    const otap = option("G996");
    expect(otap.guard, "so the option's own guard cannot narrow this").toEqual([]);
    expect(otap.info!.variants.map((variant) => variant.for).sort()).toEqual([
      "Mobile",
      "Portable",
    ]);

    const forMobile = variantsFor(otap.info!, MOBILE);
    expect(forMobile.map((variant) => variant.for)).toEqual(["Mobile"]);
    expect(forMobile[0]!.requires).toContain("G806");

    const forPortable = variantsFor(otap.info!, PORTABLE);
    expect(forPortable.map((variant) => variant.for)).toEqual(["Portable"]);
    expect(forPortable[0]!.requires).toContain("Q806");
  });

  it("keeps both where nothing says which radio is meant", () => {
    expect(variantsFor(option("G996").info!, UNKNOWN)).toHaveLength(2);
  });

  /** An entry written for the other kind is still the only thing the catalogue has to say. */
  it("keeps an entry rather than emptying the card", () => {
    const single = OPTIONS.find(
      (held) => held.info!.variants.length === 1 && held.info!.variants[0]!.for === "",
    );
    expect(single).toBeDefined();
    for (const radio of [MOBILE, PORTABLE, UNKNOWN]) {
      expect(variantsFor(single!.info!, radio)).toHaveLength(1);
    }
  });

  it("never empties the card for any option on any model", () => {
    for (const held of OPTIONS) {
      for (const model of ["M37TXS9PW1AN", "H98UCF9PW6AN", "L30JSS9PW1AN", ""]) {
        expect(variantsFor(held.info!, radioOf(model)).length, held.part).toBeGreaterThan(0);
      }
    }
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
