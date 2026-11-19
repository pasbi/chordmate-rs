import { describe, expect, it } from "vitest";
import { transposeChord } from "./transpose.ts";

describe("transposeChord", () => {
  it("keeps chords as written without transposition", () => {
    expect(transposeChord("Bbmaj7", 0)).toBe("Bbmaj7");
  });

  it("shifts the root and keeps the rest", () => {
    expect(transposeChord("Am7", 2)).toBe("Bm7");
    expect(transposeChord("Csus4", -1)).toBe("Bsus4");
    expect(transposeChord("Gadd9", 5)).toBe("Cadd9");
  });

  it("writes transposed notes with sharps, also from flats", () => {
    expect(transposeChord("Bb", 2)).toBe("C");
    expect(transposeChord("Eb", 1)).toBe("E");
    expect(transposeChord("A", 1)).toBe("A#");
    expect(transposeChord("Ebm", -1)).toBe("Dm");
  });

  it("wraps around the octave", () => {
    expect(transposeChord("B", 1)).toBe("C");
    expect(transposeChord("C", -1)).toBe("B");
    expect(transposeChord("G", 11)).toBe("F#");
  });

  it("shifts a bass note after a slash", () => {
    expect(transposeChord("Am7/G", 2)).toBe("Bm7/A");
    expect(transposeChord("D/F#", -2)).toBe("C/E");
  });

  it("shifts a chord in parentheses", () => {
    expect(transposeChord("(Em)", 3)).toBe("(Gm)");
  });

  it("leaves text that isn't a chord alone", () => {
    expect(transposeChord("N.C.", 2)).toBe("N.C.");
    expect(transposeChord("x2", 2)).toBe("x2");
  });
});
