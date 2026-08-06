import { useEffect, useRef, useState } from "react";

import { type Code } from "../flashcode";
import { OptionDetail, type Anchor } from "./OptionDetail";
import {
  type Group,
  type Option,
  type Radio,
  carriedBy,
  describeGuard,
  fieldValueOf,
  isOn,
  readableOn,
  withOption,
} from "../options";

interface Props {
  code: Code;
  groups: Group[];
  radio: Radio;
  filter: string;
  /** Options to pick out, from whatever bit the pointer is over in the grid. */
  highlight: Set<number>;
  /** Options jumped to from the grid, which stay marked and get scrolled to. */
  pinned: Set<number>;
  /** Leave out the options the model does not carry. */
  offeredOnly: boolean;
  onChange: (code: number[]) => void;
  onHover: (options: Option[]) => void;
}

/** How long the pointer has to rest on a row before the card covers the bits it lit up. */
const DELAY = 450;

function matches(option: Option, filter: string): boolean {
  if (!filter) {
    return true;
  }
  const wanted = filter.toLowerCase();
  return (
    option.part.toLowerCase().includes(wanted) || option.name.toLowerCase().includes(wanted)
  );
}

/**
 * Whether a row is shown at all.
 *
 * An option a model does not carry is only hidden where the model settles the question. With no
 * model, `carriedBy` answers `null` for every guarded option and nothing is hidden, which is why
 * the toggle is disabled there rather than quietly doing nothing.
 *
 * An option the code currently holds is never hidden, whatever the model says. Motorola not
 * offering something is exactly the situation this tool exists for, and a set bit that no row
 * accounts for would be a code editing itself out of view.
 *
 * A row that is not a reading of this radio's bits is a different matter, and goes whatever the
 * toggle says. The two band layouts lay different meanings over the same bits, so such a row can
 * read as on by coincidence: its box would be ticked for a value it does not hold, and clearing it
 * would take the whole field with it. It is not that Motorola will not sell it, it is that it does
 * not describe this radio at all, so there is nothing for it to say here.
 */
export function shows(
  option: Option,
  filter: string,
  radio: Radio,
  offeredOnly: boolean,
  code: Code,
): boolean {
  if (radio.carries && !readableOn(option, radio)) {
    return false;
  }
  const hidden = offeredOnly && carriedBy(option, radio) === false && !isOn(code, option);
  return matches(option, filter) && !hidden;
}

/**
 * Whether a group appears at all, which is the same rule as `shows` one level up.
 *
 * A group holding a value none of its shown options names has no row to keep on the strength of
 * being on, so dropping it would leave its bits set with nothing in the list accounting for them.
 * Its header reports the value, so that is what stays. That goes for a multi-bit flag as much as
 * for a chooser: a field two bits wide holding one of them names no option either.
 *
 * Not against the filter, which `shows` does not exempt a set option from either: a search is a
 * request to see less, and a header with nothing under it is not a search result.
 */
export function showsGroup(
  group: Group,
  shown: number,
  held: number,
  filter: string,
  radio: Radio,
): boolean {
  // A group none of whose options this radio could read is the other layout's field, and goes for
  // the same reason its rows do.
  if (radio.carries && !group.options.some((option) => readableOn(option, radio))) {
    return false;
  }
  return shown > 0 || (held !== 0 && !filter);
}

function Row({
  option,
  code,
  radio,
  highlight,
  pinned,
  first,
  onChange,
  onHover,
  onDescribe,
}: {
  option: Option;
  code: Code;
  radio: Radio;
  highlight: Set<number>;
  pinned: boolean;
  /** Whether this is the row a jump should bring into view. */
  first: boolean;
  onChange: (code: number[]) => void;
  onHover: (options: Option[]) => void;
  onDescribe: (option: Option | null, anchor: Anchor | null) => void;
}) {
  const on = isOn(code, option);
  const carried = carriedBy(option, radio);
  const row = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (first) {
      // Guarded because jsdom does not implement scrolling, and a missing scroll is not a reason
      // for the list to fail to render.
      row.current?.scrollIntoView?.({ block: "nearest" });
    }
  }, [first]);

  const classes = [
    "option",
    on ? "on" : "",
    highlight.has(option.id) ? "lit" : "",
    pinned ? "pinned" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li
      ref={row}
      className={classes}
      onMouseEnter={(event) => {
        onHover([option]);
        const box = event.currentTarget.getBoundingClientRect();
        onDescribe(option, { top: box.top, left: box.left, right: box.right });
      }}
      onMouseLeave={() => {
        onHover([]);
        onDescribe(null, null);
      }}
    >
      <label>
        <input
          type="checkbox"
          checked={on}
          onChange={() => onChange(withOption(code, option, !on))}
        />
        <span className="part">{option.part}</span>
        <span className="name">{option.name}</span>
      </label>
      <span
        className="where"
        title={
          option.width > 1
            ? `Digit ${option.character}, bits ${option.lsb} to ${option.lsb + option.width - 1}, holding ${option.value}`
            : `Digit ${option.character}, bit ${option.lsb}`
        }
      >
        D{option.character} B{option.lsb}
        {option.width > 1 ? `-${option.lsb + option.width - 1} = ${option.value}` : ""}
      </span>
      {carried === false ? (
        <span className="refused" title={`Motorola does not list this for ${radio.model}`}>
          not offered
        </span>
      ) : null}
      {carried === null && option.guard.length > 0 ? (
        <span className="guarded">{describeGuard(option.guard)}</span>
      ) : null}
    </li>
  );
}

/**
 * Every option in the table, grouped by the bits it reads.
 *
 * A group whose options are alternative values of one field is shown as such, with the number the
 * field currently holds, because a value that names no option is a real state a code can be in and
 * a row of unticked boxes would misreport it as nothing being set.
 */
export function OptionList({
  code,
  groups,
  radio,
  filter,
  highlight,
  pinned,
  offeredOnly,
  onChange,
  onHover,
}: Props) {
  // Only the first pinned row is scrolled to, so that a bit read by several options settles on one
  // place rather than fighting over where to land.
  const target = groups
    .flatMap((group) => group.options)
    .find((option) => pinned.has(option.id) && shows(option, filter, radio, offeredOnly, code));

  const [described, setDescribed] = useState<{ option: Option; anchor: Anchor } | null>(null);
  const waiting = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Raise the card only once the pointer has settled.
   *
   * It is placed over the bit grid, where the hovered option's bits are lit, so it has to hold off
   * long enough to read them. It also means sweeping the list never flashes a card per row.
   */
  function describe(option: Option | null, anchor: Anchor | null) {
    if (waiting.current) {
      clearTimeout(waiting.current);
      waiting.current = null;
    }
    if (!option || !anchor) {
      setDescribed(null);
      return;
    }
    waiting.current = setTimeout(() => setDescribed({ option, anchor }), DELAY);
  }

  // A card outliving the list it belongs to would be a card nothing can dismiss.
  useEffect(() => () => {
    if (waiting.current) {
      clearTimeout(waiting.current);
    }
  }, []);

  // Each group with the rows it keeps and the value its bits hold, worked out once: both the
  // decision to show the group and the rows inside it need all three.
  const standing = groups
    .map((group) => ({
      group,
      shown: group.options.filter((option) => shows(option, filter, radio, offeredOnly, code)),
      held: fieldValueOf(code, group),
    }))
    .filter(({ group, shown, held }) => showsGroup(group, shown.length, held, filter, radio));

  return (
    <div className="options" onMouseLeave={() => describe(null, null)}>
      {standing.length === 0 ? (
        // An empty box reads as a list that failed to load. Which of the two narrowings emptied it
        // is the thing worth saying, since one of them is a checkbox somebody may have forgotten.
        <p className="note">
          {filter
            ? `No option matches ${filter.trim()}.`
            : `Every option is hidden. ${radio.model || "This radio"} carries none of them.`}
        </p>
      ) : null}
      {standing.map(({ group, shown, held }) => {
        // An empty field is not an unrecognised value. Nothing can be on when the bits are clear,
        // since no option's value is zero, and the row of clear checkboxes says so accurately.
        // Over the options this radio reads rather than the rows a search left standing: an
        // option filtered out of view still names the value, and saying otherwise would be false.
        const names =
          held !== 0 &&
          !group.options.some(
            (option) =>
              isOn(code, option) && (!radio.carries || readableOn(option, radio)),
          );
        return (
          <section key={group.key} className="group">
            {group.chooser || group.width > 1 || shown.length === 0 ? (
              <header>
                <span
                  className="where"
                  title={`Digit ${group.character}, bits ${group.lsb} to ${group.lsb + group.width - 1}`}
                >
                  D{group.character} B{group.lsb}-{group.lsb + group.width - 1}
                </span>
                <span className={names ? "held unrecognised" : "held"}>
                  holds {held}
                  {names ? " (names no option)" : ""}
                </span>
              </header>
            ) : null}
            <ul>
              {shown.map((option) => (
                <Row
                  key={option.id}
                  option={option}
                  code={code}
                  radio={radio}
                  highlight={highlight}
                  pinned={pinned.has(option.id)}
                  first={option.id === target?.id}
                  onChange={onChange}
                  onHover={onHover}
                  onDescribe={describe}
                />
              ))}
            </ul>
          </section>
        );
      })}
      {described?.option.info ? (
        <OptionDetail info={described.option.info} radio={radio} anchor={described.anchor} />
      ) : null}
    </div>
  );
}
