import { ALPHABET, BITS, LENGTH, type Code, bitSet, withBit } from "../flashcode";
import { type Option, optionsAt } from "../options";

interface Props {
  code: Code;
  named: Set<number>;
  /** Bits to pick out, as `character * 6 + bit`, from whatever the pointer is over. */
  highlight: Set<number>;
  onChange: (code: number[]) => void;
  onHover: (options: Option[]) => void;
  /** Show me the options that read this bit. A left click toggles, so this is the right one. */
  onJump: (options: Option[]) => void;
}

/**
 * The twenty-four characters as a grid of bits.
 *
 * Six columns, not eight: a character holds values 0 to 63, so bits 6 and 7 do not exist and
 * offering them would let someone set a bit that cannot be written. Bit 0 is the least significant
 * and the columns run 5 to 0 so that a row reads the way the binary is written.
 */
export function BitGrid({ code, named, highlight, onChange, onHover, onJump }: Props) {
  const bits = [...Array(BITS).keys()].reverse();

  return (
    <table className="grid">
      <thead>
        <tr>
          <th className="index" scope="col">digit</th>
          {bits.map((bit) => (
            <th key={bit} scope="col">
              {bit}
            </th>
          ))}
          <th className="value" scope="col">value</th>
          <th className="glyph" />
        </tr>
      </thead>
      <tbody>
        {[...Array(LENGTH).keys()].map((character) => {
          const value = code[character] ?? 0;
          return (
            <tr key={character} className={value === 0 ? "quiet" : undefined}>
              <th className="index" scope="row">{character}</th>
              {bits.map((bit) => {
                const at = character * BITS + bit;
                const set = bitSet(code, character, bit);
                const classes = [
                  "bit",
                  set ? "on" : "off",
                  named.has(at) ? "named" : "unnamed",
                  highlight.has(at) ? "lit" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                const reading = optionsAt(character, bit);
                return (
                  <td key={bit}>
                    <button
                      type="button"
                      className={classes}
                      aria-label={`digit ${character} bit ${bit}`}
                      aria-pressed={set}
                      title={
                        reading.length
                          ? `Digit ${character}, bit ${bit}: ${reading
                              .map((option) => option.part)
                              .join(", ")}. Right click to show ${
                              reading.length === 1 ? "it" : "them"
                            } in the list.`
                          : `Digit ${character}, bit ${bit}: no option names it.`
                      }
                      onClick={() => onChange(withBit(code, character, bit, !set))}
                      onContextMenu={(event) => {
                        // The browser menu has nothing useful to offer over a bit.
                        event.preventDefault();
                        onJump(reading);
                      }}
                      onMouseEnter={() => onHover(reading)}
                      onMouseLeave={() => onHover([])}
                    >
                      {set ? "1" : "0"}
                    </button>
                  </td>
                );
              })}
              <td className="value">{value}</td>
              <td className="glyph">{ALPHABET[value]}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
