import { describe, expect, it } from "vitest";

import { empty, format, full, parse } from "./flashcode";
import { read, write } from "./fragment";

const CODE = "000080-000000-3-000000-000000";

describe("writing a fragment", () => {
  it("writes the bare code when there is nothing else to say", () => {
    expect(write(parse(CODE).code, "")).toBe(CODE);
  });

  /** Otherwise opening the site would put a link to its own default state in the address bar. */
  it("writes nothing at all for a page holding nothing", () => {
    expect(write(empty(), "")).toBe("");
    expect(write(empty(), "  ")).toBe("");
  });

  it("still writes the empty code once a model names something", () => {
    expect(write(empty(), "H98UCF9PW6AN")).toBe(
      "000000-000000-0-000000-000000;model=H98UCF9PW6AN",
    );
  });

  it("adds the model only when there is one", () => {
    expect(write(parse(CODE).code, "H98UCF9PW6AN")).toBe(`${CODE};model=H98UCF9PW6AN`);
  });

  it("treats whitespace as nothing", () => {
    expect(write(parse(CODE).code, "   ")).toBe(CODE);
  });

  it("leaves the code readable, since the separators are outside the alphabet", () => {
    // `&`, `+` and `%` are all in the alphabet, which is why neither `&` nor a query parser is
    // used: `;` and `=` are the only punctuation a code can never contain.
    const written = write(full(), "M37TXS9PW1AN");
    expect(written).toBe("%%%%%%-%%%%%%-4-%%%%%%-%%%%%%;model=M37TXS9PW1AN");
    expect(written).not.toContain("%25");
  });
});

describe("reading a fragment", () => {
  /**
   * `null` is not a lost code but an unnamed one, which the page reads as the empty code it starts
   * from. That is what lets the empty code be written as no fragment at all.
   */
  it("reads back everything it writes, for codes across the alphabet", () => {
    for (const code of [empty(), full(), parse("1ALWgt-$%5FRb-4-2CNYjv-&7HTdq").code]) {
      for (const model of ["", "H98UCF9PW6AN"]) {
        const back = read(`#${write(code, model)}`);
        expect(back.code ?? empty(), format(code)).toEqual(code);
        expect(back.model).toBe(model);
      }
    }
  });

  /** Links shared before the fragment carried anything else are a bare code. */
  it("still reads the older form, a code and nothing more", () => {
    const back = read(`#${CODE}`);
    expect(back.code).toEqual(parse(CODE).code);
    expect(back.model).toBe("");
  });

  /**
   * `%5F` is a valid percent escape for `_`, so decoding this code first would quietly turn it into
   * something eleven characters short. The written form has to be tried before the decoded one.
   */
  it("keeps a code whose own characters look like a percent escape", () => {
    const written = "1ALWgt-$%5FRb-4-2CNYjv-&7HTdq";
    expect(decodeURIComponent(written)).not.toBe(written);
    expect(read(`#${written};model=H98UCF9PW6AN`).code).toEqual(parse(written).code);
  });

  it("reads a code a browser has percent encoded", () => {
    const back = read(`#${encodeURIComponent("%%%%%%-%%%%%%-4-%%%%%%-%%%%%%")};model=H98UCF9PW6AN`);
    expect(back.code).toEqual(full());
    expect(back.model).toBe("H98UCF9PW6AN");
  });

  it("gives up on a field rather than on the fragment", () => {
    for (const hash of ["", "#", "#nonsense", "#%", "#%zz", "#;model=", "#;;;", "#=x"]) {
      const back = read(hash);
      expect(back.code, hash).toBeNull();
      expect(back.model, hash).toBe("");
    }
  });

  it("keeps a good code when a later field is malformed", () => {
    const back = read(`#${CODE};model`);
    expect(back.code).toEqual(parse(CODE).code);
    expect(back.model).toBe("");
  });

  it("ignores a field it does not know", () => {
    const back = read(`#${CODE};zoom=3;model=H98UCF9PW6AN`);
    expect(back.model).toBe("H98UCF9PW6AN");
  });
});
