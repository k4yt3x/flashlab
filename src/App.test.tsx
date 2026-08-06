// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

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
    // The catalogue states what an order would have needed alongside it.
    expect(card?.textContent).toContain("Requires QA01833");
    expect(card?.textContent).toContain("Conflicts with");

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

    // Digit 0 bit 5 is Geofence, whose mobile naming this portable does not carry.
    rightClick(0, 5);
    expect(toggle().checked).toBe(false);
    expect(pinnedRows()).toHaveLength(2);
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
});
