import { describe, expect, it } from "vitest";
import { shows, showsGroup } from "./components/OptionList";
import { MODELS } from "./models";
import { OPTIONS, fieldValueOf, groups, namedFor, radioOf } from "./options";

/**
 * That no set bit can end up with nothing in the list accounting for it.
 *
 * The rule has three parts that pull against each other: an option the model does not carry is
 * hidden, an option the code holds is kept anyway, and an option that is not a reading of this
 * radio's bits is dropped whatever the code says. Swept rather than argued about, since the whole
 * reachable space is 24 characters by 64 values: every group lives inside one character.
 */

describe("no set bit goes unaccounted for", () => {
  it("holds for every model, every character and every value, both toggle states", () => {
    const held = groups(OPTIONS);
    const orphans: string[] = [];
    for (const model of MODELS) {
      const radio = radioOf(model.model);
      const named = namedFor(radio);
      for (const offeredOnly of [false, true]) {
        for (let character = 0; character < 24; character += 1) {
          for (let value = 0; value < 64; value += 1) {
            const code = Array.from({ length: 24 }, (_, at) => (at === character ? value : 0));
            for (let bit = 0; bit < 6; bit += 1) {
              if (((value >> bit) & 1) === 0) continue;
              if (!named.has(character * 6 + bit)) continue;
              const rows = OPTIONS.filter(
                (o) => o.character === character && bit >= o.lsb && bit < o.lsb + o.width
                  && shows(o, "", radio, offeredOnly, code),
              );
              // A group that renders with no rows reports the value its bits hold in its header.
              // Only a group this radio can read counts: one belonging to the other layout is not
              // an account of anything here, which is why `showsGroup` is asked rather than
              // assumed.
              const header = held.some((g) => {
                if (g.character !== character || bit < g.lsb || bit >= g.lsb + g.width) {
                  return false;
                }
                const surviving = g.options.filter((o) => shows(o, "", radio, offeredOnly, code));
                return showsGroup(g, surviving.length, fieldValueOf(code, g), "", radio);
              });
              if (rows.length === 0 && !header) {
                orphans.push(`${model.model} D${character}B${bit} value ${value} offeredOnly=${offeredOnly}`);
              }
            }
          }
        }
      }
    }
    expect(orphans.slice(0, 5), `${orphans.length} orphaned bits`).toEqual([]);
  });
});
