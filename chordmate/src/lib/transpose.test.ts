import { describe, expect, it } from "vitest";
import { transposeChord, wrapTranspose } from "./transpose.ts";

describe("transposeChord", () => {
  it("spells untransposed chords, too", () => {
    expect(transposeChord("Bbmaj7", 0, "sharps")).toBe("A#maj7");
    expect(transposeChord("Am7", 0, "sharps")).toBe("Am7");
  });

  it("shifts the root and keeps the rest", () => {
    expect(transposeChord("Am7", 2, "sharps")).toBe("Bm7");
    expect(transposeChord("Csus4", -1, "sharps")).toBe("Bsus4");
    expect(transposeChord("Gadd9", 5, "sharps")).toBe("Cadd9");
  });

  it("writes transposed notes with sharps, also from flats", () => {
    expect(transposeChord("Bb", 2, "sharps")).toBe("C");
    expect(transposeChord("Eb", 1, "sharps")).toBe("E");
    expect(transposeChord("A", 1, "sharps")).toBe("A#");
    expect(transposeChord("Ebm", -1, "sharps")).toBe("Dm");
  });

  it("wraps around the octave", () => {
    expect(transposeChord("B", 1, "sharps")).toBe("C");
    expect(transposeChord("C", -1, "sharps")).toBe("B");
    expect(transposeChord("G", 11, "sharps")).toBe("F#");
  });

  it("shifts a bass note after a slash", () => {
    expect(transposeChord("Am7/G", 2, "sharps")).toBe("Bm7/A");
    expect(transposeChord("D/F#", -2, "sharps")).toBe("C/E");
  });

  it("shifts a chord in parentheses", () => {
    expect(transposeChord("(Em)", 3, "sharps")).toBe("(Gm)");
  });

  it("leaves text that isn't a chord alone", () => {
    expect(transposeChord("N.C.", 2, "sharps")).toBe("N.C.");
    expect(transposeChord("x2", 2, "sharps")).toBe("x2");
  });
});

describe("transposeChord with the common names", () => {
  it("uses C#, Eb, F#, Ab and Bb, also untransposed", () => {
    expect(transposeChord("A#m", 0, "common")).toBe("Bbm");
    expect(transposeChord("D#", 0, "common")).toBe("Eb");
    expect(transposeChord("G#7/C", 0, "common")).toBe("Ab7/C");
    expect(transposeChord("Db", 0, "common")).toBe("C#");
    expect(transposeChord("Gb", 0, "common")).toBe("F#");
    expect(transposeChord("C", 3, "common")).toBe("Eb");
  });
});

describe("transposeChord with flats", () => {
  it("writes every note with flats, also untransposed", () => {
    expect(transposeChord("A#m7", 0, "flats")).toBe("Bbm7");
    expect(transposeChord("D#/G#", 0, "flats")).toBe("Eb/Ab");
    expect(transposeChord("A", 1, "flats")).toBe("Bb");
    expect(transposeChord("C#", 0, "flats")).toBe("Db");
  });

  it("leaves naturals and text that isn't a chord alone", () => {
    expect(transposeChord("Am7/G", 0, "flats")).toBe("Am7/G");
    expect(transposeChord("N.C.", 0, "flats")).toBe("N.C.");
  });
});

describe("wrapTranspose", () => {
  it("keeps transpositions from −5 to +6", () => {
    expect(wrapTranspose(-5)).toBe(-5);
    expect(wrapTranspose(0)).toBe(0);
    expect(wrapTranspose(6)).toBe(6);
  });

  it("wraps around the octave", () => {
    expect(wrapTranspose(7)).toBe(-5);
    expect(wrapTranspose(-6)).toBe(6);
    expect(wrapTranspose(12)).toBe(0);
  });
});
