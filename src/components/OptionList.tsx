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
 */
function shows(option: Option, filter: string, radio: Radio, offeredOnly: boolean): boolean {
  return matches(option, filter) && !(offeredOnly && carriedBy(option, radio) === false);
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
        <span className="refused" title={`Motorola does not offer this for ${radio.model}`}>
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
    .find((option) => pinned.has(option.id) && shows(option, filter, radio, offeredOnly));

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

  return (
    <div className="options" onMouseLeave={() => describe(null, null)}>
      {groups.map((group) => {
        const shown = group.options.filter((option) => shows(option, filter, radio, offeredOnly));
        if (shown.length === 0) {
          return null;
        }
        const held = fieldValueOf(code, group);
        const names = group.chooser && !group.options.some((option) => isOn(code, option));
        return (
          <section key={group.key} className="group">
            {group.chooser ? (
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
        <OptionDetail info={described.option.info} anchor={described.anchor} />
      ) : null}
    </div>
  );
}
