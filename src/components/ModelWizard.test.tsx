// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ModelWizard } from "./ModelWizard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let chosen: string;

function show(value: string) {
  chosen = value;
  act(() =>
    root.render(<ModelWizard value={value} onChange={(model) => show(model)} />),
  );
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  show("");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** The label of the question currently being asked. */
function asking(): string {
  return container.querySelector(".wizard .ask")?.textContent ?? "";
}

/** The choices offered for it. */
function offered(): string[] {
  return [...container.querySelectorAll<HTMLButtonElement>(".wizard .options-grid button")].map(
    (held) => held.textContent ?? "",
  );
}

function choose(label: string) {
  const button = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (held) => held.textContent === label,
  );
  if (!button) {
    throw new Error(`no button labelled ${label}, saw ${offered().join(", ")}`);
  }
  act(() => button.click());
}

function open() {
  choose("Choose");
}

describe("the model box", () => {
  it("takes no more than a model number's twelve characters", () => {
    const input = container.querySelector<HTMLInputElement>("input.number")!;
    expect(input.maxLength).toBe(12);
  });

  it("marks its placeholder as an example, not as a model in force", () => {
    const input = container.querySelector<HTMLInputElement>("input.number")!;
    expect(input.placeholder).toMatch(/^e\.g\. /);
    // And an empty box really is empty, whatever the placeholder shows.
    expect(input.value).toBe("");
    expect(container.querySelector(".chosen")).toBeNull();
  });

  it("takes a number typed straight in, upper casing it", () => {
    const input = container.querySelector<HTMLInputElement>("input.number")!;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "m37txs9pw1an");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(chosen).toBe("M37TXS9PW1AN");
    expect(container.querySelector(".chosen")?.textContent).toContain("APX 8500");
  });

  function type(text: string) {
    const input = container.querySelector<HTMLInputElement>("input.number")!;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  it("says nothing at all about an empty box", () => {
    expect(container.querySelector(".chosen")).toBeNull();
    expect(container.querySelector(".complaint")).toBeNull();
  });

  it("keeps a number it does not know, but refuses to resolve it", () => {
    type("H00XXX0XX0XX");
    expect(container.querySelector<HTMLInputElement>("input.number")!.value).toBe("H00XXX0XX0XX");
    expect(container.querySelector(".chosen")).toBeNull();
    expect(container.querySelector(".complaint")?.textContent).toContain("Unknown model number");
  });

  /** A half typed number still starts with the character the naming rules read. */
  it("warns the moment a known number is edited into an unknown one", () => {
    type("M37TXS9PW1AN");
    expect(container.querySelector(".chosen")).not.toBeNull();
    expect(container.querySelector(".complaint")).toBeNull();

    type("M37TXS9PW1A");
    expect(container.querySelector(".chosen")).toBeNull();
    expect(container.querySelector(".complaint")).not.toBeNull();
  });
});

describe("the wizard", () => {
  it("asks for the product type first", () => {
    open();
    expect(asking()).toBe("Product type");
    expect(offered()).toEqual(["Mobile", "Portable"]);
  });

  it("walks type, family, model type and band in that order", () => {
    open();
    choose("Portable");
    expect(asking()).toBe("Product family");
    expect(offered()).toContain("APX 6000");

    choose("APX 6000");
    expect(asking()).toBe("Model type");
    expect(offered()).toContain("Model 3.5 A");

    choose("Model 3.5 A");
    expect(asking()).toBe("Frequency band");
    expect(offered()).toContain("VHF");

    choose("VHF");
    // One radio is an APX 6000 Model 3.5 A on VHF, so the wizard closes on it.
    expect(chosen).toMatch(/^H/);
    expect(container.querySelector(".wizard")).toBeNull();
  });

  it("skips a question every remaining radio answers the same way", () => {
    open();
    choose("Portable");
    choose("APX 8000");
    // Every APX 8000 is all band, so the band is never asked: model type comes next and is last.
    expect(asking()).toBe("Model type");
    choose("Model 3.5");
    expect(chosen).toMatch(/^H/);
  });

  it("offers model numbers when the four questions do not reach one radio", () => {
    open();
    choose("Mobile");
    choose("APX 4500");
    // Every APX 4500 is mid power, so that question is skipped and the band comes next.
    expect(asking()).toBe("Frequency band");
    choose("7/800");
    expect(asking()).toContain("differ by nothing left to ask");
    expect(offered().length).toBeGreaterThan(1);
    for (const label of offered()) {
      expect(label).toMatch(/^[LMT][A-Z0-9]{11}$/);
    }
    choose(offered()[0]!);
    expect(chosen).toMatch(/^[LMT]/);
  });

  /**
   * The APX NEXT single band radios state no model type at all, so the tier is empty and used to
   * render as a button with nothing written on it.
   */
  it("never offers a choice with no label on it", () => {
    open();
    choose("Portable");
    choose("APX NEXT");
    expect(asking()).toBe("Model type");
    expect(offered()).toContain("Not stated");
    for (const label of offered()) {
      expect(label.trim()).not.toBe("");
    }
  });

  it("labels an unstated model type in the trail too, once picked", () => {
    open();
    choose("Portable");
    choose("APX NEXT");
    choose("Not stated");
    const trail = [...container.querySelectorAll(".wizard .trail button")].map(
      (held) => held.textContent ?? "",
    );
    expect(trail.some((held) => held.includes("Not stated"))).toBe(true);
  });

  it("offers a label on every choice at every step, for every family", () => {
    for (const type of ["Portable", "Mobile"]) {
      open();
      choose(type);
      const families = offered();
      choose("Close");
      for (const family of families) {
        open();
        choose(type);
        choose(family);
        for (const label of offered()) {
          expect(label.trim(), `${type} / ${family}`).not.toBe("");
        }
        if (container.querySelector(".wizard")) {
          choose("Close");
        }
        show("");
      }
    }
  });

  it("lets an answer be taken back, dropping the ones asked after it", () => {
    open();
    choose("Portable");
    choose("APX 6000");
    expect(asking()).toBe("Model type");

    // The trail carries each answer; clicking one unpicks it and everything later.
    const trail = container.querySelector<HTMLButtonElement>(".wizard .trail button")!;
    expect(trail.textContent).toContain("Portable");
    act(() => trail.click());
    expect(asking()).toBe("Product type");
    expect(offered()).toEqual(["Mobile", "Portable"]);
  });

  it("says how many radios are still in play", () => {
    open();
    const before = container.querySelector(".wizard .count")?.textContent ?? "";
    choose("Portable");
    const after = container.querySelector(".wizard .count")?.textContent ?? "";
    expect(before).toMatch(/^\d+ models match$/);
    expect(Number.parseInt(after, 10)).toBeLessThan(Number.parseInt(before, 10));
  });

  it("closes on Escape, since it tells a screen reader it is modal", () => {
    open();
    expect(container.querySelector(".wizard")).not.toBeNull();
    act(() => void document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(container.querySelector(".wizard")).toBeNull();
    expect(chosen).toBe("");
  });

  it("closes without choosing anything", () => {
    open();
    choose("Close");
    expect(container.querySelector(".wizard")).toBeNull();
    expect(chosen).toBe("");
  });

  /**
   * `aria-modal` tells a screen reader the rest of the page is not there. Leaving the page behind
   * the sheet in the tab order makes that a lie, and the lie is the dangerous direction: a reader
   * announcing a dialog while the keyboard is typing into the code box behind it.
   */
  describe("keeping focus inside, which is what aria-modal claims", () => {
    function tab(shiftKey = false): KeyboardEvent {
      const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey, cancelable: true });
      act(() => void document.dispatchEvent(event));
      return event;
    }

    function stops(): HTMLElement[] {
      return [...container.querySelectorAll<HTMLElement>(".wizard .sheet button")];
    }

    it("takes focus on open and says it is modal", () => {
      open();
      const sheet = container.querySelector<HTMLElement>(".wizard .sheet")!;
      expect(container.querySelector(".wizard")!.getAttribute("aria-modal")).toBe("true");
      expect(document.activeElement).toBe(sheet);
    });

    it("wraps forward off the last control rather than leaving the sheet", () => {
      open();
      const held = stops();
      expect(held.length).toBeGreaterThan(1);
      held.at(-1)!.focus();
      expect(tab().defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(held[0]);
    });

    it("wraps backward off the first", () => {
      open();
      const held = stops();
      held[0]!.focus();
      expect(tab(true).defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(held.at(-1));
    });

    /** The case that matters: the page behind is still focusable, so Tab has to take it back. */
    it("takes focus back from anything behind the sheet", () => {
      open();
      const behind = container.querySelector<HTMLInputElement>("input.number")!;
      behind.focus();
      expect(document.activeElement).toBe(behind);
      expect(tab().defaultPrevented).toBe(true);
      expect(container.querySelector(".wizard .sheet")!.contains(document.activeElement)).toBe(
        true,
      );
    });

    it("leaves an ordinary step to the browser", () => {
      open();
      stops()[0]!.focus();
      expect(tab().defaultPrevented).toBe(false);
    });
  });
});
