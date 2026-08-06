/**
 * What the bits mean.
 *
 * The table says, for each option in the catalogue, which digit of the code it lives in, which
 * bits of that character it occupies, and what those bits have to hold for it to be on. Most
 * options are one bit holding one, but a few are several bits holding a number, and those are why
 * an option cannot be modelled as a bit index.
 *
 * The option list is a **view**. The twenty-four values are the state, and nothing here ever
 * rebuilds a code from a set of options, which is exactly what lets you clear one option without
 * disturbing the bits around it and keep bits no option names.
 */

import { type Code, fieldValue, withField } from "./flashcode";
import table from "./data/options.json";

/** What the option catalogue says, for the radios one entry of it covers. */
export interface Variant {
  /** `Portable` or `Mobile`, and empty where there is only one variant to tell apart from nothing. */
  for: string;
  /** The release the option arrived in. */
  release: string;
  /** Part numbers the catalogue says an order needs alongside this one. */
  requires: readonly string[];
  /** Part numbers the catalogue says cannot be ordered with this one. */
  conflicts: readonly string[];
}

/**
 * An option as Motorola sells it rather than as the radio reads it.
 *
 * None of it is enforced here. A requirement or a conflict is what an order would have been held
 * to, and this is a tool for setting bits, so it is shown and left alone.
 */
export interface Info {
  title: string;
  description: string;
  variants: readonly Variant[];
}

/** One option: a part number, a name, and the bits that decide whether it is on. */
export interface Option {
  /** Stable within one table revision. A part number is not unique, so this is the identity. */
  id: number;
  /** Motorola's part number, `QA04447` and the like. */
  part: string;
  name: string;
  character: number;
  /** The least significant bit of the field, counting from 0. */
  lsb: number;
  width: number;
  /** What the field has to equal. One, for every option that is a single flag. */
  value: number;
  /** Which radios carry it, as a conjunction of the atoms below. Empty means all of them. */
  guard: readonly string[];
  /** What the catalogue says about it, for the options it lists. */
  info?: Info;
}

export const OPTIONS: readonly Option[] = table.options;

/** What a model number says about a radio. `null` for a model that has not been given. */
export interface Radio {
  model: string;
  mobile: boolean | null;
  is8500hp: boolean;
  singleBand8900: boolean;
}

/** The two models with their own high power band part numbers. */
const HIGH_POWER_8500 = ["M37TXS9PW1AN", "M37TXS9PW1CN"];

/**
 * Read a model number.
 *
 * Mobile against portable is the first character: `H` is a portable, `L`, `M` and `T` are mobiles.
 * That holds without exception across every model in `data/models.json`, which is why no kind is
 * shipped alongside them. A model number that says neither leaves `mobile` unknown, and every
 * option is then shown under both its names.
 */
export function radioOf(model: string): Radio {
  const written = model.trim().toUpperCase();
  const first = written[0] ?? "";
  return {
    model: written,
    mobile: first === "H" ? false : "LMT".includes(first) && first !== "" ? true : null,
    is8500hp: HIGH_POWER_8500.includes(written),
    singleBand8900: written[3] === "V",
  };
}

/** A radio nothing is known about, which is what an empty model box means. */
export const UNKNOWN: Radio = { model: "", mobile: null, is8500hp: false, singleBand8900: false };

function atom(name: string, radio: Radio): boolean | null {
  switch (name) {
    case "mobile":
      return radio.mobile;
    case "portable":
      return radio.mobile === null ? null : !radio.mobile;
    case "is8500hp":
      return radio.mobile === null ? null : radio.is8500hp;
    case "singleband8900":
      return radio.mobile === null ? null : radio.singleBand8900;
    default:
      return null;
  }
}

/**
 * Whether a radio carries an option, or `null` when the model does not say.
 *
 * An unknown model leaves every model-dependent option unresolved rather than guessing, so the UI
 * can show it under both its mobile and portable names instead of picking one.
 */
export function carriedBy(option: Option, radio: Radio): boolean | null {
  let unknown = false;
  for (const written of option.guard) {
    const negated = written.startsWith("!");
    const held = atom(negated ? written.slice(1) : written, radio);
    if (held === null) {
      unknown = true;
      continue;
    }
    if (held === negated) {
      return false;
    }
  }
  return unknown ? null : true;
}

/** How to say a guard in the interface. */
export function describeGuard(guard: readonly string[]): string {
  const words: Record<string, string> = {
    mobile: "mobiles",
    "!mobile": "portables",
    portable: "portables",
    "!portable": "mobiles",
    is8500hp: "APX 8500 high power",
    "!is8500hp": "not APX 8500 high power",
    singleband8900: "single band 8/900",
    "!singleband8900": "not single band 8/900",
  };
  return guard.map((written) => words[written] ?? written).join(", ");
}

/**
 * The bits an option shares with every other option reading the same bits.
 *
 * Two options are in the same group when they cover the same run of bits in the same character. A
 * group holding more than one value is a chooser, since its options are alternative readings of one
 * number and at most one can be on. A group holding one value is a flag, possibly under two names
 * for the two kinds of radio.
 */
function groupKey(option: Option): string {
  return `${option.character}:${option.lsb}:${option.width}`;
}

export interface Group {
  key: string;
  character: number;
  lsb: number;
  width: number;
  options: Option[];
  /** True when the group's options are alternative values of one field rather than one flag. */
  chooser: boolean;
}

/** Every group in the table, ordered by the bits they occupy. */
export function groups(options: readonly Option[] = OPTIONS): Group[] {
  const held = new Map<string, Group>();
  for (const option of options) {
    const key = groupKey(option);
    let group = held.get(key);
    if (!group) {
      group = {
        key,
        character: option.character,
        lsb: option.lsb,
        width: option.width,
        options: [],
        chooser: false,
      };
      held.set(key, group);
    }
    group.options.push(option);
  }
  for (const group of held.values()) {
    group.chooser = new Set(group.options.map((option) => option.value)).size > 1;
    group.options.sort((a, b) => a.value - b.value || a.part.localeCompare(b.part));
  }
  return [...held.values()].sort(
    (a, b) => a.character - b.character || a.lsb - b.lsb || a.width - b.width,
  );
}

/** Whether an option's bits currently hold the value that turns it on. */
export function isOn(code: Code, option: Option): boolean {
  return fieldValue(code, option.character, option.lsb, option.width) === option.value;
}

/**
 * The number a group's bits hold, whether or not any option claims it.
 *
 * Worth showing for a chooser, because a field holding a value no option names is an ordinary state
 * for a hand-edited code and a row of empty checkboxes would report it as nothing being set.
 */
export function fieldValueOf(code: Code, group: Pick<Group, "character" | "lsb" | "width">): number {
  return fieldValue(code, group.character, group.lsb, group.width);
}

/**
 * Turn an option on or off.
 *
 * Turning one on writes its value into its bits. Turning one off writes zero, which is what an
 * option being absent means. For a chooser that means clearing the whole field rather than stepping
 * to another value, since no other value is implied.
 */
export function withOption(code: Code, option: Option, on: boolean): number[] {
  return withField(code, option.character, option.lsb, option.width, on ? option.value : 0);
}

/** Every option a code currently has on, whether or not the radio is supposed to carry it. */
export function optionsOn(code: Code, options: readonly Option[] = OPTIONS): Option[] {
  return options.filter((option) => isOn(code, option));
}

/** The bits any option in the table names, as `character * 6 + bit`. */
export function namedBits(options: readonly Option[] = OPTIONS): Set<number> {
  const bits = new Set<number>();
  for (const option of options) {
    for (let at = 0; at < option.width; at += 1) {
      bits.add(option.character * 6 + option.lsb + at);
    }
  }
  return bits;
}

/** Every option reading a given bit, which is what makes the grid legible. */
export function optionsAt(
  character: number,
  bit: number,
  options: readonly Option[] = OPTIONS,
): Option[] {
  return options.filter(
    (option) =>
      option.character === character && bit >= option.lsb && bit < option.lsb + option.width,
  );
}
