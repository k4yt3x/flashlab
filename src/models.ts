/**
 * The radios, and the axes a picker walks to reach one.
 *
 * A FLASHcode carries no model, so this exists only so that nobody has to recall a twelve character
 * part number. The rules that actually use a model read the number itself, which is why anything
 * typed is accepted whether it appears here or not.
 */

import table from "./data/models.json";

export interface Model {
  /** The twelve character model number, as printed on the radio. */
  model: string;
  /** The product it belongs to, `APX 8500` and the like. */
  family: string;
  /** The model type within that product: a display tier on a portable, an RF deck on a mobile.
   * Empty where a product was sold in one configuration only. */
  tier: string;
  band: string;
}

export const MODELS: readonly Model[] = table.models;

/** The axes a picker walks, in the order it walks them. */
export const AXES = ["type", "family", "tier", "band"] as const;
export type Axis = (typeof AXES)[number];

export const AXIS_NAMES: Record<Axis, string> = {
  type: "Product type",
  family: "Product family",
  tier: "Model type",
  band: "Frequency band",
};

/**
 * What to call an axis value that is not stated.
 *
 * Only the model type is ever empty, and only where the description names no tier: the APX NEXT
 * single band radios and the handful of products sold in one configuration. Inventing a name for
 * that would be worse than admitting it, so it is admitted.
 */
export const UNSTATED = "Not stated";

/** How to show an axis value, which matters only where the value is nothing. */
export function labelOf(value: string): string {
  return value === "" ? UNSTATED : value;
}

/** What a model holds on one axis. */
export function axisOf(model: Model, axis: Axis): string {
  switch (axis) {
    case "type":
      return model.model.startsWith("H") ? "Portable" : "Mobile";
    case "family":
      return model.family;
    case "tier":
      return model.tier;
    case "band":
      return model.band;
  }
}

export type Picks = Partial<Record<Axis, string>>;

/** Every model still matching what has been picked so far. */
export function candidates(picks: Picks): Model[] {
  return MODELS.filter((model) =>
    AXES.every((axis) => picks[axis] === undefined || axisOf(model, axis) === picks[axis]),
  );
}

/** Low frequency first, then the wideband radios, rather than alphabetically. */
const BAND_ORDER = ["VHF", "UHF", "UHF 1", "UHF 2", "7/800", "8/900", "900", "Multiple"];

function compare(axis: Axis, a: string, b: string): number {
  if (axis === "band") {
    const at = BAND_ORDER.indexOf(a);
    const bt = BAND_ORDER.indexOf(b);
    return (at < 0 ? BAND_ORDER.length : at) - (bt < 0 ? BAND_ORDER.length : bt);
  }
  // Numeric so that APX 900 sorts before APX 1000 rather than after it.
  return a.localeCompare(b, undefined, { numeric: true });
}

/** The distinct values still reachable on one axis, in the order to offer them. */
export function choices(picks: Picks, axis: Axis): string[] {
  const held = new Set(candidates(picks).map((model) => axisOf(model, axis)));
  return [...held].sort((a, b) => compare(axis, a, b));
}

/**
 * The axes still worth asking about, given what has been picked.
 *
 * An axis every remaining model agrees on is not a question, so it is not asked. That covers a
 * product sold in one configuration, whose model type is empty and would otherwise be an empty
 * button.
 */
export function remainingAxes(picks: Picks): Axis[] {
  return AXES.filter((axis) => picks[axis] === undefined && choices(picks, axis).length > 1);
}

/**
 * The model the picks land on, if they land on exactly one.
 *
 * Walking all four axes does not always get there: 24 of the 161 paths through them reach more than
 * one radio, because two models can agree on every axis and differ only by something none of them
 * names. The caller offers the survivors by model number when that happens.
 */
export function settled(picks: Picks): Model | null {
  const found = candidates(picks);
  return found.length === 1 ? (found[0] ?? null) : null;
}

/** The record for a model number, if it is one this knows. */
export function lookup(model: string): Model | null {
  const wanted = model.trim().toUpperCase();
  return MODELS.find((held) => held.model === wanted) ?? null;
}

/**
 * Whether a model number names a radio this knows about.
 *
 * The naming and availability rules read the model number directly, and they read it loosely: the
 * first character alone decides portable against mobile. So a half typed number goes on producing
 * answers, which is worse than producing none, because the answers look right. Nothing is applied
 * unless the number names a radio in the list.
 */
export function isKnown(model: string): boolean {
  return lookup(model) !== null;
}
