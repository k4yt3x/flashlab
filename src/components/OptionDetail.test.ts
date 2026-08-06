import { describe, expect, it } from "vitest";

import { WIDTH, place } from "./OptionDetail";

/**
 * The card sits left of the row, over the bit grid. Hovering an option lights up the bits it
 * occupies, and a delay before the card appears is what keeps those readable; see the option list.
 */
describe("placing the detail card", () => {
  it("puts it left of the row, where there is room", () => {
    const anchor = { top: 300, left: 580, right: 1640 };
    expect(place(anchor, { width: 1920, height: 900 }).left).toBe(580 - WIDTH - 10);
  });

  it("goes right instead when the left would run off screen", () => {
    // A narrow window stacks the columns, so the row starts near the left edge.
    const anchor = { top: 300, left: 20, right: 700 };
    expect(place(anchor, { width: 1100, height: 900 }).left).toBe(710);
  });

  it("keeps the card on screen whichever way it goes", () => {
    const anchors = [
      { top: 300, left: 580, right: 1640 },
      { top: 300, left: 20, right: 700 },
      { top: 300, left: 340, right: 1380 },
      { top: 300, left: 5, right: 360 },
    ];
    for (const viewport of [1920, 1400, 1000, 700]) {
      for (const anchor of anchors) {
        const { left } = place(anchor, { width: viewport, height: 900 });
        expect(left, `${viewport} / ${anchor.left}`).toBeGreaterThanOrEqual(0);
        expect(left, `${viewport} / ${anchor.left}`).toBeLessThanOrEqual(viewport);
      }
    }
  });

  it("keeps it on screen top and bottom", () => {
    const near = { top: 880, left: 600, right: 900 };
    expect(place(near, { width: 1600, height: 900 }).top).toBeLessThan(880);
    const above = { top: -50, left: 600, right: 900 };
    expect(place(above, { width: 1600, height: 900 }).top).toBeGreaterThanOrEqual(0);
  });
});
