// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { RELEASE } from "./models";
import { nameOf } from "./options";
import models from "./data/models.json";

/**
 * That the page mounts and that its two editors really are two views of one state.
 *
 * A type check cannot catch a component that throws on its first render, and the linked-views
 * behaviour is the whole design, so it is worth holding to something more than inspection.
 */

let container: HTMLDivElement;
let root: Root;

// React only lets `act` flush updates when it is told it is in a test environment.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  window.location.hash = "";
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<App />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function written(): string {
  return container.querySelector<HTMLInputElement>("input.written")!.value;
}

/** Remount the app against a given fragment, and report the code it opened on. */
function remounted(fragment: string): string {
  act(() => root.unmount());
  window.location.hash = fragment;
  root = createRoot(container);
  act(() => root.render(<App />));
  return written();
}

function bit(character: number, at: number): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>(
    `button[aria-label="digit ${character} bit ${at}"]`,
  );
  if (!found) {
    throw new Error(`the grid should hold digit ${character} bit ${at}`);
  }
  return found;
}

/** Click the button a given label names. */
function press(label: string) {
  const buttons = [...container.querySelectorAll<HTMLButtonElement>("button")];
  const found = buttons.find((button) => button.textContent === label);
  if (!found) {
    throw new Error(`the page should hold a ${label} button`);
  }
  found.click();
}

describe("the page", () => {
  it("mounts and starts on an empty code", () => {
    expect(container.querySelector("h1")?.textContent).toBe("FLASHlab");
    expect(written()).toBe("000000-000000-0-000000-000000");
  });

  it("offers six bits per digit and no more, across all twenty-four", () => {
    expect(container.querySelectorAll("button.bit")).toHaveLength(24 * 6);
    expect(
      container.querySelector('button[aria-label="digit 0 bit 6"]'),
    ).toBeNull();
  });

  it("writes a bit edit back into the code, check digit and all", () => {
    act(() => bit(0, 5).click());
    // Digit 0 holding 32 is `Y`, so the string reads `Y00000`.
    expect(written()).toBe("Y00000-000000-0-000000-000000");
    expect(bit(0, 5).getAttribute("aria-pressed")).toBe("true");
  });

  it("says which version and commit it was built from", () => {
    const build = container.querySelector(".banner .build")?.textContent ?? "";
    expect(build).toMatch(/^v\d+\.\d+\.\d+/);
    // The hash is only there when the build had a repository to ask, so it is optional; when it is
    // there it links to that commit.
    const link = container.querySelector<HTMLAnchorElement>(".banner .build a");
    if (link) {
      expect(link.textContent).toMatch(/^[0-9a-f]{7,40}$/);
      expect(link.href).toBe(`https://github.com/k4yt3x/flashlab/commit/${link.textContent}`);
    }
  });

  /**
   * The tables are a snapshot of one Motorola release, and almost everything in them moves between
   * releases: which options exist, which bits they sit on, which radios are sold with them. Someone
   * comparing this against a radio has to be able to see which release they are looking at, so it
   * is shown rather than left in a data file, and shown even in a build that knows neither its own
   * version nor its commit.
   */
  it("says which release the option and model data describes", () => {
    expect(container.querySelector(".banner .release")?.textContent).toBe(`data ${RELEASE}`);
    expect(RELEASE).toMatch(/^R\d+\.\d+\.\d+$/);
    // It is the release both shipped tables were taken from, so it has to come from the data
    // rather than be typed into the page.
    expect(RELEASE).toBe(models.release);
  });

  it("states the licence and disclaims the marks it has to use to name things", () => {
    const footer = container.querySelector("footer")?.textContent ?? "";
    expect(footer).toContain("MIT License");
    expect(footer).toContain("K4YT3X");
    // Naming a radio means naming somebody's trademark, so say whose and on what footing.
    expect(footer).toContain("Motorola Solutions, Inc.");
    expect(footer).toContain("identification only");
    expect(footer).toContain("educational purposes only");
    expect(footer).toContain("not affiliated with or endorsed by");
    // MIT grants rights, so claiming they are all reserved would contradict the licence.
    expect(footer).not.toContain("All Rights Reserved");
  });

  it("gives each option's position as a digit and a bit", () => {
    // GA00631 is digit 7, bit 3, so the list says D7 B3.
    expect(row("GA00631").querySelector(".where")?.textContent).toBe("D7 B3");
    // A multi-bit option names its span and the value those bits have to hold.
    expect(row("QA04832").querySelector(".where")?.textContent).toBe("D2 B0-4 = 7");
    expect(container.querySelector(".grid th.index")?.textContent).toBe("digit");
  });

  /**
   * The check digit is a 25th character sitting between digit 11 and digit 12, not a digit of the
   * payload. Digit 12 is ordinary and settable, and named by no option, which is a different thing.
   */
  it("keeps digit 12 settable, since it is payload and not the check digit", () => {
    act(() => bit(12, 3).click());
    expect(bit(12, 3).getAttribute("aria-pressed")).toBe("true");

    const flat = written().replaceAll("-", "");
    expect(flat).toHaveLength(25);
    // The check digit holds position 12; digit 12 of the payload lands one place past it.
    expect(flat[12]).toBe("3");
    expect(flat[13]).toBe("8");
  });

  it("shows an option the newly set bit turns on", () => {
    act(() => bit(0, 5).click());
    const ticked = [...container.querySelectorAll<HTMLInputElement>(".option input:checked")];
    const names = ticked.map((box) => box.closest(".option")?.textContent ?? "");
    expect(names.some((name) => name.includes("QA04447"))).toBe(true);
    expect(names.some((name) => name.includes("Geofence"))).toBe(true);
  });

  it("narrows the option list from the box above it", () => {
    const before = container.querySelectorAll(".option").length;
    expect(before).toBeGreaterThan(100);

    const filter = container.querySelector<HTMLInputElement>("input.filter")!;
    expect(filter.placeholder).toBe("Filter by part number or name");
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(filter, "geofence");
      filter.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const shown = [...container.querySelectorAll(".option")];
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(before);
    for (const held of shown) {
      expect(held.textContent?.toLowerCase()).toContain("geofence");
    }
  });

  /** Digit 0 bit 5 is Geofence, under both its mobile and portable names. */
  function pinnedRows(): string[] {
    return [...container.querySelectorAll(".option.pinned")].map((held) => held.textContent ?? "");
  }

  function rightClick(character: number, at: number): MouseEvent {
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    act(() => void bit(character, at).dispatchEvent(event));
    return event;
  }

  it("jumps from a bit to the options that read it, and suppresses the browser menu", () => {
    expect(pinnedRows()).toEqual([]);
    expect(rightClick(0, 5).defaultPrevented).toBe(true);
    const rows = pinnedRows();
    expect(rows).toHaveLength(2);
    expect(rows.join(" ")).toContain("QA04447");
    expect(rows.join(" ")).toContain("GA01202");
  });

  it("has no double click gesture, only the right click one", () => {
    act(() => bit(0, 5).dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    expect(pinnedRows()).toEqual([]);
  });

  it("clears the filter when jumping, so the row it lands on is not hidden", () => {
    const filter = container.querySelector<HTMLInputElement>("input.filter")!;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(filter, "otar");
      filter.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.querySelectorAll(".option").length).toBeLessThan(20);

    rightClick(0, 5);
    expect(container.querySelector<HTMLInputElement>("input.filter")!.value).toBe("");
    expect(pinnedRows().length).toBeGreaterThan(0);
  });

  it("does nothing when a bit no option names is jumped to", () => {
    // No option in the table names digit 12.
    rightClick(12, 3);
    expect(pinnedRows()).toEqual([]);
  });

  /** The row for a part number, wherever the list has put it. */
  function row(part: string): HTMLElement {
    const found = [...container.querySelectorAll<HTMLElement>(".option")].find((held) =>
      held.textContent?.includes(part),
    );
    if (!found) {
      throw new Error(`the list should hold ${part}`);
    }
    return found;
  }

  it("describes an option from the catalogue once the pointer rests on it", () => {
    expect(container.querySelector(".detail")).toBeNull();

    act(() => row("QA02006").dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    // The card sits over the bit grid, so it waits long enough to read the bits it lit up.
    expect(container.querySelector(".detail")).toBeNull();
    act(() => void vi.advanceTimersByTime(1000));

    const card = container.querySelector(".detail");
    expect(card).not.toBeNull();
    expect(card?.textContent).toContain("APX XE");
    expect(card?.textContent).toContain("XE housing");
    expect(card?.textContent).toContain("Release 7.9 MOL");
    // The catalogue states what an order would have needed alongside it, and a bare part number
    // says nothing, so each one is named.
    expect(card?.textContent).toContain("Requires QA01833");
    expect(card?.textContent).toContain(`QA01833 ${nameOf("QA01833")}`);
    expect(card?.textContent).toContain("Conflicts with");
    const cited = [...(card?.querySelectorAll(".cited") ?? [])];
    expect(cited.length).toBeGreaterThan(0);
    for (const held of cited) {
      const part = held.querySelector(".part")?.textContent ?? "";
      expect(part).toMatch(/^[A-Z0-9]{3,8}$/);
      // Every part number the catalogue cites is one this table names, so none renders bare.
      expect(held.textContent).toBe(`${part} ${nameOf(part)}`);
    }

    act(() => row("QA02006").dispatchEvent(new MouseEvent("mouseout", { bubbles: true })));
    expect(container.querySelector(".detail")).toBeNull();
  });

  it("raises no card at all when the pointer only sweeps past", () => {
    act(() => row("QA02006").dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    act(() => row("QA02006").dispatchEvent(new MouseEvent("mouseout", { bubbles: true })));
    act(() => void vi.advanceTimersByTime(1000));
    expect(container.querySelector(".detail")).toBeNull();
  });

  it("names the radio kind only where the catalogue says different things about each", () => {
    // Bluetooth is listed for both, and the two entries differ, so both are shown and labelled.
    act(() => row("QA00583").dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    act(() => void vi.advanceTimersByTime(1000));
    const labels = [...container.querySelectorAll(".detail .for")].map((held) => held.textContent);
    expect(labels).toEqual(["Mobile", "Portable"]);

    // Geofence on a portable is one entry, so there is nothing to distinguish.
    act(() => row("QA04447").dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    act(() => void vi.advanceTimersByTime(1000));
    expect(container.querySelectorAll(".detail .for")).toHaveLength(0);
    expect(container.querySelector(".detail")?.textContent).toContain("geofencing");
  });

  /**
   * The two entries do not merely differ in wording. `G996` asks a mobile order for `W947` and
   * `G806` and a portable one for `Q947` and `Q806`, so showing both to one radio prints a
   * requirement in part numbers that radio cannot take. The option carries no guard, so nothing in
   * the table narrows this and only the model can.
   */
  it("shows the catalogue entry for the radio in the box, not both", () => {
    function card(part: string): string {
      act(() => row(part).dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
      act(() => void vi.advanceTimersByTime(1000));
      const held = container.querySelector(".detail")?.textContent ?? "";
      act(() => row(part).dispatchEvent(new MouseEvent("mouseout", { bubbles: true })));
      return held;
    }

    // With no model, both, since nothing here should invent an answer.
    const both = card("G996");
    expect(both).toContain("G806");
    expect(both).toContain("Q806");

    typeModel("M37TXS9PW1AN");
    const mobile = card("G996");
    expect(mobile).toContain("G806");
    expect(mobile, "a mobile cannot take the portable's requirements").not.toContain("Q806");

    typeModel("H98UCF9PW6AN");
    const portable = card("G996");
    expect(portable).toContain("Q806");
    expect(portable, "nor the other way round").not.toContain("G806");
  });

  function typeModel(text: string) {
    const input = container.querySelector<HTMLInputElement>("input.number")!;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  function refused(): number {
    return container.querySelectorAll(".option .refused").length;
  }

  /**
   * The naming rules read the model number loosely, the first character deciding portable against
   * mobile, so a half typed number went on marking options as not offered on the strength of a
   * string that names no radio.
   */
  it("applies a model's rules only once the number names a radio", () => {
    expect(refused()).toBe(0);

    typeModel("H91TGD9PW9AN");
    expect(refused()).toBeGreaterThan(0);

    typeModel("H91TGD9PW9A");
    expect(refused()).toBe(0);

    typeModel("");
    expect(refused()).toBe(0);
  });

  /** An empty box reads as a list that failed to load rather than as a search with no results. */
  it("says why the list is empty rather than showing an empty box", () => {
    const search = container.querySelector<HTMLInputElement>("input.filter")!;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(search, "zzzz");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.querySelectorAll(".option")).toHaveLength(0);
    expect(container.querySelector(".options .note")?.textContent).toBe("No option matches zzzz.");
  });

  function toggle(): HTMLInputElement {
    return container.querySelector<HTMLInputElement>(".offered input")!;
  }

  function shownRows(): number {
    return container.querySelectorAll(".option").length;
  }

  it("can leave out the options the model does not carry", () => {
    expect(toggle().disabled).toBe(true);

    typeModel("H98UCF9PW6AN");
    expect(toggle().disabled).toBe(false);
    const all = shownRows();
    const refused = container.querySelectorAll(".option .refused").length;
    expect(refused).toBeGreaterThan(0);

    act(() => toggle().click());
    expect(shownRows()).toBe(all - refused);
    expect(container.querySelectorAll(".option .refused")).toHaveLength(0);

    act(() => toggle().click());
    expect(shownRows()).toBe(all);
  });

  /**
   * Hiding an option that is *on* would hide a set bit, and a code holding an option its model's
   * family does not list is exactly the case worth being able to read.
   */
  it("never hides an option the code holds, whatever the model says", () => {
    function rowFor(part: string): Element | undefined {
      return [...container.querySelectorAll(".option")].find(
        (row) => row.querySelector(".part")?.textContent === part,
      );
    }

    typeModel("H98UCF9PW6AN");
    // Digit 14 bit 0 is the ETSI regulatory region, which this radio's family does not list.
    act(() => bit(14, 0).click());
    expect(rowFor("QA08157")?.querySelector(".refused")).not.toBeNull();

    act(() => toggle().click());
    expect(rowFor("QA08157"), "a set bit must keep its row").toBeDefined();
    expect(rowFor("QA08157")?.querySelector(".refused")).not.toBeNull();

    // Turn it back off and the row goes, since now nothing is being hidden from view.
    act(() => bit(14, 0).click());
    expect(rowFor("QA08157")).toBeUndefined();
  });

  /**
   * The same rule as the row above, for a field rather than a row. A chooser holding a value no
   * option names has no row to keep, so hiding the group took its bits out of view along with it.
   */
  it("never hides a chooser whose field holds a value no option names", () => {
    function header(): Element | undefined {
      return [...container.querySelectorAll(".group header .where")].find(
        (span) => span.textContent === "D3 B0-4",
      );
    }

    typeModel("H98UCF9PW6AN");
    // Digit 3 holding 7 names no secondary band, and this radio carries none of the options there.
    act(() => bit(3, 0).click());
    act(() => bit(3, 1).click());
    act(() => bit(3, 2).click());
    expect(header()).toBeDefined();

    act(() => toggle().click());
    expect(header(), "a field with bits set must keep its group").toBeDefined();
    expect(header()!.parentElement!.textContent).toContain("names no option");
  });

  /**
   * The group rule keeps a chooser whose bits are set, but a search is a request to see less, and a
   * header with nothing under it is not a search result. `shows` does not exempt a set option from
   * the filter either, so the two rules have to agree about it.
   */
  it("keeps nothing a search excluded, header or row", () => {
    typeModel("H98UCF9PW6AN");
    act(() => bit(3, 0).click());
    act(() => bit(3, 1).click());
    act(() => bit(3, 2).click());
    expect(container.querySelectorAll(".group header").length).toBeGreaterThan(0);

    const search = container.querySelector<HTMLInputElement>(".filter")!;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(search, "zzzzz");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.querySelectorAll(".option")).toHaveLength(0);
    expect(container.querySelectorAll(".group")).toHaveLength(0);
  });

  /** Nothing can be on when the bits are clear, so the row of clear checkboxes is not misreporting. */
  it("does not call an empty field an unrecognised value", () => {
    expect(container.querySelectorAll(".held.unrecognised")).toHaveLength(0);
    // Digit 3 holding 7 is a value no secondary band names, which is the state the flag is for.
    act(() => bit(3, 0).click());
    act(() => bit(3, 1).click());
    act(() => bit(3, 2).click());
    expect(container.querySelectorAll(".held.unrecognised").length).toBeGreaterThan(0);
  });

  /**
   * Digits 2 and 3 carry two band layouts over the same bits, so a row from the layout a radio does
   * not use can read as on by coincidence. It describes nothing here, and its checkbox would clear
   * the whole field, so being on is not a reason to keep it.
   */
  it("keeps the other layout's row, marked rather than removed", () => {
    function rowFor(part: string, where: string): Element | undefined {
      return [...container.querySelectorAll(".option")].find(
        (row) =>
          row.querySelector(".part")?.textContent === part &&
          row.querySelector(".where")?.textContent === where,
      );
    }

    // With no model, both layouts are shown: nothing says which one applies.
    act(() => bit(2, 0).click());
    act(() => bit(2, 1).click());
    expect(rowFor("GA00307", "D2 B0-4 = 3")).toBeDefined();

    // A refreshed radio, whose bands are one bit each at digit 2. The five-bit field is the other
    // layout's reading of the same bits, and it stays: the table is the whole bit space, and what
    // a radio does not use is annotated rather than removed.
    typeModel("H15KDF9PW6AN");
    const other = rowFor("GA00307", "D2 B0-4 = 3");
    expect(other, "the other layout's row stays").toBeDefined();
    expect(other?.querySelector(".refused")?.textContent).toBe("not offered");
    expect(rowFor("QA00570", "D2 B0"), "its own layout stays too").toBeDefined();

    // The toggle is the one thing that does remove it, being an explicit ask. Even then a row the
    // code holds stays: digit 2 reads 3, which is this row's value, and hiding a set bit would be
    // the code editing itself out of view.
    act(() => toggle().click());
    expect(rowFor("GA00307", "D2 B0-4 = 3"), "held by the code").toBeDefined();

    // Clear the bits and the toggle may take it, since nothing is standing on it any more.
    act(() => bit(2, 0).click());
    act(() => bit(2, 1).click());
    expect(rowFor("GA00307", "D2 B0-4 = 3"), "not held, not offered").toBeUndefined();

    // And with the toggle off it is back, marked rather than gone.
    act(() => toggle().click());
    expect(rowFor("GA00307", "D2 B0-4 = 3")).toBeDefined();
    const headers = [...container.querySelectorAll(".group header .where")].map(
      (span) => span.textContent,
    );
    expect(headers).toContain("D2 B0-4");
  });

  /**
   * A two-bit band field holding one of its bits names no option, and being a flag group rather
   * than a chooser it had no header to fall back on, so the group vanished with its bits set. The
   * VX-P949 portables are where it shows: they read digit 2 bits 3 and 4 as one 7/800 field.
   */
  it("accounts for a multi-bit flag field holding a value it does not name", () => {
    typeModel("H93KDF9PW6AN");
    act(() => bit(2, 3).click());
    act(() => toggle().click());

    const headers = [...container.querySelectorAll(".group header .where")].map(
      (span) => span.textContent,
    );
    expect(headers).toContain("D2 B3-4");
  });

  /** The grid must not offer a jump the list will not honour, nor name a bit it will not show. */
  /**
   * The grid is a map of the code, not of one model. A bit some option names is named whichever
   * radio is in the box, and a jump reaches every row the list holds for it, so the two views stay
   * two readings of one state rather than drifting apart under a model.
   */
  it("names and jumps by every option, whatever the model says", () => {
    typeModel("H15KDF9PW6AN");
    // W12 is a mobile option and this is a portable, but the bit is still named and still reachable.
    expect(bit(0, 1).className).toContain("named");
    expect(bit(0, 1).getAttribute("title") ?? "").toContain("W12");
    rightClick(0, 1);
    expect(pinnedRows().some((row) => row.includes("W12"))).toBe(true);
  });

  /**
   * Choosing a model must only ever add to what a row says. The guard is a fact about the part
   * number, not about the radio, and it is what explains a "not offered" badge, so dropping it once
   * a model resolves removed the explanation exactly when there was something to explain.
   */
  it("keeps saying which radios a part number names a bit for, model or no model", () => {
    function badge(part: string): string | undefined {
      return row(part).querySelector(".guarded")?.textContent ?? undefined;
    }

    // GA01202 and QA04447 are one bit under two part numbers, one per kind of radio.
    expect(badge("GA01202")).toBe("mobiles");
    expect(badge("QA04447")).toBe("portables");

    typeModel("M37TSS9PW1CN");
    expect(badge("GA01202"), "still the mobile naming").toBe("mobiles");
    expect(badge("QA04447"), "still the portable naming").toBe("portables");
    // And the portable one now also says it does not apply, which is the addition rather than a
    // replacement of what was there before.
    expect(row("QA04447").querySelector(".refused")?.textContent).toBe("not offered");
    expect(row("GA01202").querySelector(".refused")).toBeNull();

    typeModel("H98UCF9PW6AN");
    expect(badge("GA01202")).toBe("mobiles");
    expect(row("GA01202").querySelector(".refused")?.textContent).toBe("not offered");
  });

  /** The colour and the label are two renderings of one answer, so they cannot drift apart. */
  it("colours a row exactly when it carries the not offered label", () => {
    typeModel("M37TSS9PW1CN");
    const red = [...container.querySelectorAll(".option.unavailable")];
    const badged = [...container.querySelectorAll(".option .refused")].map(
      (span) => span.closest(".option"),
    );
    expect(red.length).toBeGreaterThan(0);
    expect(red).toEqual(badged);
    // A row that applies is left alone, whether or not the code holds it.
    expect(row("GA01202").className).not.toContain("unavailable");
    act(() => bit(0, 5).click());
    expect(row("GA01202").className).toContain("on");
    expect(row("GA01202").className).not.toContain("unavailable");
  });

  it("offers nothing to hide until a model says what is carried", () => {
    // With no model every guarded option is unresolved, so the toggle would do nothing at all.
    expect(toggle().disabled).toBe(true);
    typeModel("H91TGD9PW9A");
    expect(toggle().disabled).toBe(true);
    typeModel("H91TGD9PW9AN");
    expect(toggle().disabled).toBe(false);
  });

  it("stops hiding when a jump would otherwise land on a hidden row", () => {
    typeModel("H98UCF9PW6AN");
    act(() => toggle().click());
    expect(toggle().checked).toBe(true);

    // Digit 0 bit 5 is Geofence, one bit under two part numbers. Both rows are reachable, and the
    // mobile one is marked not offered rather than withheld.
    rightClick(0, 5);
    expect(toggle().checked).toBe(false);
    const rows = pinnedRows();
    expect(rows).toHaveLength(2);
    expect(rows.some((row) => row.includes("QA04447"))).toBe(true);
    expect(rows.some((row) => row.includes("GA01202"))).toBe(true);
  });

  it("copies the OEM encoder's code, not the one being edited", async () => {
    const copied: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: (text: string) => void copied.push(text) },
    });

    // A full code is one no OEM encoder can reproduce, so the two differ and a mix-up would show.
    const buttons = [...container.querySelectorAll<HTMLButtonElement>("button")];
    act(() => buttons.find((held) => held.textContent === "Full")!.click());
    act(() => container.querySelector<HTMLButtonElement>(".oem button.copy")!.click());

    expect(copied).toHaveLength(1);
    expect(copied[0]).toBe(container.querySelector(".oem .written")?.textContent);
    expect(copied[0]).not.toBe(written());
  });

  it("takes a pasted code and reports a wrong check digit without refusing it", () => {
    const input = container.querySelector<HTMLInputElement>("input.written")!;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(input, "000080-000000-9-000000-000000");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.querySelector(".complaint")?.textContent).toContain("should be 3");
    // Read anyway: character 4 bit 3 is the Advanced System Key.
    expect(bit(4, 3).getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps the code in the address bar, where it is never sent anywhere", () => {
    act(() => bit(0, 5).click());
    expect(decodeURIComponent(window.location.hash)).toBe("#Y00000-000000-0-000000-000000");
  });

  /**
   * Opening the site used to write a link to its own default state into the address bar, which is
   * what anyone bookmarking it would then keep. Nothing is written until there is something to
   * share, and clearing the page takes it back off.
   */
  it("leaves the address bar alone while the page holds nothing", () => {
    expect(window.location.hash).toBe("");

    act(() => bit(0, 5).click());
    expect(window.location.hash).not.toBe("");

    act(() => press("Empty"));
    expect(window.location.hash).toBe("");
  });

  it("carries the model in the link too, so a page can be shared whole", () => {
    typeModel("M37TXS9PW1AN");
    expect(window.location.hash).toContain("model=M37TXS9PW1AN");

    // Opening that link puts the page back where it was, marks and all.
    const shared = window.location.hash;
    act(() => root.unmount());
    window.location.hash = shared;
    root = createRoot(container);
    act(() => root.render(<App />));
    expect(container.querySelector<HTMLInputElement>("input.number")!.value).toBe("M37TXS9PW1AN");
    expect(container.querySelector(".model .chosen")?.textContent).toContain("APX 8500");
    expect(container.querySelectorAll(".option .refused").length).toBeGreaterThan(0);
  });

  it("leaves the filter out of the link, being a search rather than a state", () => {
    const filter = container.querySelector<HTMLInputElement>("input.filter")!;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(filter, "otar");
      filter.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(window.location.hash).not.toContain("otar");
    expect(window.location.hash).not.toContain("filter");
  });

  it("starts from a code the address bar already names", () => {
    expect(remounted("#000080-000000-3-000000-000000")).toBe("000080-000000-3-000000-000000");
  });

  /**
   * The alphabet holds `%`, so a fragment carrying a code is not valid percent encoding. Decoding
   * it throws, and throwing while working out the first state renders nothing at all: a link to an
   * all-set code used to open a blank page.
   */
  it("opens a fragment holding the alphabet's percent signs", () => {
    expect(remounted("#%%%%%%-%%%%%%-4-%%%%%%-%%%%%%")).toBe("%%%%%%-%%%%%%-4-%%%%%%-%%%%%%");
    expect(remounted("#7%%%y%-y%#%%y-6-%%&%%%-%%%%%%")).toBe("7%%%y%-y%#%%y-6-%%&%%%-%%%%%%");
  });

  it("opens the same fragment after a browser has percent encoded it", () => {
    expect(remounted(`#${encodeURIComponent("%%%%%%-%%%%%%-4-%%%%%%-%%%%%%")}`)).toBe(
      "%%%%%%-%%%%%%-4-%%%%%%-%%%%%%",
    );
  });

  it("survives a fragment that is not a code at all", () => {
    for (const fragment of ["#nonsense", "#%", "#%zz", "#000000-000000-0-000000"]) {
      expect(remounted(fragment)).toBe("000000-000000-0-000000-000000");
    }
  });

  it("round trips: whatever it writes into the address bar, it can read back", () => {
    for (const start of ["000080-000000-3-000000-000000", "%%%%%%-%%%%%%-4-%%%%%%-%%%%%%"]) {
      const first = remounted(`#${start}`);
      expect(remounted(window.location.hash)).toBe(first);
    }
  });

  /**
   * A shared code is the one nobody here typed, so it is the one whose check digit is worth
   * doubting, and the one where the evidence does not survive being looked at: the code is
   * reprinted with the digit recomputed and the address bar is rewritten to match. Typing the same
   * string complains, so opening it has to complain too.
   */
  it("says so when a link's check digit is wrong, rather than quietly correcting it", () => {
    expect(remounted("#000001-000000-3-000000-000000")).toBe("000001-000000-9-000000-000000");
    expect(container.querySelector(".complaint")?.textContent).toBe(
      "Check digit is 3, should be 9. The code was read anyway.",
    );
  });

  it("says nothing about a link that reads cleanly", () => {
    remounted("#000080-000000-3-000000-000000");
    expect(container.querySelector(".complaint")).toBeNull();
  });
});
