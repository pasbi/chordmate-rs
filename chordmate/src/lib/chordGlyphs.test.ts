import { describe, expect, it } from "vitest";
import { chordGlyphs } from "./chordGlyphs.ts";

describe("chordGlyphs", () => {
  it("shows sharps and flats as music signs", () => {
    expect(chordGlyphs("C#m")).toBe("C♯m");
    expect(chordGlyphs("Bb")).toBe("B♭");
    expect(chordGlyphs("Ebmaj7/Bb")).toBe("E♭maj7/B♭");
    expect(chordGlyphs("D/F#")).toBe("D/F♯");
  });

  it("shows flat and sharp alterations", () => {
    expect(chordGlyphs("G7b9")).toBe("G7♭9");
    expect(chordGlyphs("Bm7b5")).toBe("Bm7♭5");
    expect(chordGlyphs("C7#11")).toBe("C7♯11");
    expect(chordGlyphs("C7(b13)")).toBe("C7(♭13)");
  });

  it("keeps a b that is a letter", () => {
    expect(chordGlyphs("B")).toBe("B");
    expect(chordGlyphs("Bsus4")).toBe("Bsus4");
    expect(chordGlyphs("Abdim")).toBe("A♭dim");
  });
});
