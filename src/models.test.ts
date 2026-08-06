import { describe, expect, it } from "vitest";

import {
  AXES,
  MODELS,
  axisOf,
  candidates,
  carriedByModel,
  choices,
  lookup,
  remainingAxes,
  settled,
} from "./models";
import { OPTIONS, radioOf } from "./options";

describe("the model list", () => {
  it("holds only real model numbers, every one of which the rules can read", () => {
    expect(MODELS.length).toBeGreaterThan(100);
    for (const held of MODELS) {
      expect(held.model).toMatch(/^[A-Z0-9]{12}$/);
      // The whole reason no kind is shipped: the first character decides it, for every model.
      expect(radioOf(held.model).mobile).not.toBeNull();
    }
  });

  it("has no duplicate model numbers", () => {
    expect(new Set(MODELS.map((held) => held.model)).size).toBe(MODELS.length);
  });

  it("gives every model a family and a band, model type being the one that may be empty", () => {
    for (const held of MODELS) {
      expect(held.family).not.toBe("");
      expect(held.band).not.toBe("");
      expect(typeof held.tier).toBe("string");
    }
  });

  it("names every family with a published product name", () => {
    for (const held of MODELS) {
      expect(held.family, held.model).toMatch(/^(APX|SRX|ATS|TXM|VX-P)[A-Za-z0-9. ]*$/);
    }
  });

  it("gives every model an option set holding options the table names", () => {
    const parts = new Set(OPTIONS.map((option) => option.part));
    for (const held of MODELS) {
      const carried = carriedByModel(held.model);
      expect(carried, held.model).not.toBeNull();
      expect(carried!.size, held.model).toBeGreaterThan(0);
      for (const part of carried!) {
        expect(parts.has(part), `${held.model} carries ${part}`).toBe(true);
      }
    }
  });

  /**
   * Motorola states the sets per radio family, so radios of one family share one. Two models with
   * the same set are the ordinary case and two with different sets are what the whole thing is for,
   * so both are worth knowing still happen.
   */
  it("shares an option set between radios of a family and not across all of them", () => {
    const sets = new Set(MODELS.map((held) => carriedByModel(held.model)));
    expect(sets.size).toBeGreaterThan(1);
    expect(sets.size).toBeLessThan(MODELS.length);
  });

  it("knows nothing about a model number that names no radio", () => {
    expect(carriedByModel("H98UCF9PW")).toBeNull();
    expect(carriedByModel("")).toBeNull();
  });

  it("still recognises the models the option guards single out", () => {
    for (const model of ["M37TXS9PW1AN", "M37TXS9PW1CN"]) {
      expect(lookup(model)?.model).toBe(model);
      expect(radioOf(model).is8500hp).toBe(true);
    }
  });

  it("reads a model number whatever case it is written in", () => {
    expect(lookup("m37txs9pw1an")?.model).toBe("M37TXS9PW1AN");
    expect(lookup("  M37TXS9PW1AN  ")?.model).toBe("M37TXS9PW1AN");
    expect(lookup("H00XXX0XX0XX")).toBeNull();
  });
});

describe("walking the axes", () => {
  it("splits the fleet into portables and mobiles by the model number", () => {
    expect(choices({}, "type")).toEqual(["Mobile", "Portable"]);
    for (const held of candidates({ type: "Portable" })) {
      expect(held.model[0]).toBe("H");
    }
    for (const held of candidates({ type: "Mobile" })) {
      expect("LMT").toContain(held.model[0]);
    }
  });

  it("narrows the choices on each axis as the earlier ones are answered", () => {
    const all = choices({}, "family").length;
    const portables = choices({ type: "Portable" }, "family").length;
    expect(portables).toBeLessThan(all);
    expect(portables).toBeGreaterThan(0);

    const bands = choices({ type: "Portable", family: "APX 8000" }, "band");
    expect(bands).toEqual(["Multiple"]);
  });

  it("offers the bands low to high rather than alphabetically", () => {
    const bands = choices({}, "band");
    expect(bands.indexOf("VHF")).toBeLessThan(bands.indexOf("UHF 1"));
    expect(bands.indexOf("UHF 1")).toBeLessThan(bands.indexOf("7/800"));
    expect(bands.at(-1)).toBe("Multiple");
  });

  it("sorts families numerically, so APX 900 comes before APX 1000", () => {
    const families = choices({ type: "Portable" }, "family");
    expect(families.indexOf("APX 900")).toBeLessThan(families.indexOf("APX 1000"));
  });

  it("does not ask about an axis every remaining radio agrees on", () => {
    // Every APX 8000 is all band, so there is no band question left to ask.
    const picks = { type: "Portable" as const, family: "APX 8000" };
    expect(remainingAxes(picks)).not.toContain("band");
    // And it does ask about the one that still varies.
    expect(remainingAxes(picks)).toContain("tier");
  });

  it("settles on one radio only when exactly one is left", () => {
    expect(settled({})).toBeNull();
    const picks = { type: "Portable", family: "APX 8000", tier: "Model 3.5" };
    expect(settled(picks)?.model).toMatch(/^H/);
    expect(candidates(picks)).toHaveLength(1);
  });

  it("leaves some paths on more than one radio, which is why a last step is needed", () => {
    const ambiguous = new Map<string, number>();
    for (const held of MODELS) {
      const key = AXES.map((axis) => axisOf(held, axis)).join("|");
      ambiguous.set(key, (ambiguous.get(key) ?? 0) + 1);
    }
    const shared = [...ambiguous.values()].filter((count) => count > 1);
    expect(shared.length).toBeGreaterThan(0);
  });

  it("reaches every single model through the axes", () => {
    for (const held of MODELS) {
      const picks = Object.fromEntries(AXES.map((axis) => [axis, axisOf(held, axis)]));
      expect(candidates(picks)).toContainEqual(held);
    }
  });
});
