import { describe, expect, it } from "vitest";
import {
  looksLikeChordsOverLyrics,
  normalizeSongContent,
  shouldConvertPaste,
  ultimateGuitarToChordPro,
} from "./ultimateGuitar";

const lines = (...text: string[]) => text.join("\n");

describe("ultimateGuitarToChordPro", () => {
  it("moves chords into the lyric line below, at their columns", () => {
    const input = lines("Am        F#", "Lyrics go here");
    expect(ultimateGuitarToChordPro(input)).toBe("[Am]Lyrics go [F#]here");
  });

  it("pads lyrics that end before the last chord", () => {
    expect(ultimateGuitarToChordPro(lines("C       G", "Hi"))).toBe("[C]Hi [G]");
  });

  it("marks chord lines without lyrics in place", () => {
    const input = lines("| Dm7 | A#  A#add9 | x2", "", "N.C.");
    expect(ultimateGuitarToChordPro(input)).toBe(
      lines("| [Dm7] | [A#] [A#add9] | [*x2]", "", "[*N.C.]")
    );
  });

  it("does not merge a chord line into the chord line below", () => {
    expect(ultimateGuitarToChordPro(lines("Am F", "C G"))).toBe(lines("[Am] [F]", "[C] [G]"));
  });

  it("turns annotations above lyrics into annotation marks", () => {
    expect(ultimateGuitarToChordPro(lines("Intro:   G", "la la la la"))).toBe(
      "[*Intro:]la la la [G]la"
    );
  });

  it("turns section headers into comments", () => {
    expect(ultimateGuitarToChordPro("[Pre-Chorus]")).toBe("{c: Pre-Chorus}");
  });

  it("wraps tablature and the chord line above it in a tab block", () => {
    const input = lines(" G      D", "e|---3---2---|", "B|---0---3---|", "la");
    expect(ultimateGuitarToChordPro(input)).toBe(
      lines("{start_of_tab}", " G      D", "e|---3---2---|", "B|---0---3---|", "{end_of_tab}", "la")
    );
  });

  it("removes Ultimate Guitar's markup without breaking alignment", () => {
    const input = lines("[tab][ch]Am[/ch]    [ch]C[/ch]", "Hello world[/tab]");
    expect(ultimateGuitarToChordPro(input)).toBe("[Am]Hello [C]world");
  });

  it("keeps the alignment of chord lines it does not recognize", () => {
    const input = lines("Cmaj7    C (let ring)", "foo        bar");
    expect(ultimateGuitarToChordPro(input)).toBe(input);
  });

  it("tidies whitespace only after converting", () => {
    const input = lines("", "Am          F#", "Lyrics   go here", " ", " ", "Am");
    expect(ultimateGuitarToChordPro(input)).toBe(lines("[Am]Lyrics go [F#]here", "", "[Am]"));
  });
});

describe("looksLikeChordsOverLyrics", () => {
  it("accepts chord lines", () => {
    expect(looksLikeChordsOverLyrics(lines("[Verse]", "Am  F", "Hello"))).toBe(true);
  });

  it("rejects ChordPro and plain lyrics", () => {
    expect(looksLikeChordsOverLyrics(lines("[Am]Hello", "Am F"))).toBe(false);
    expect(looksLikeChordsOverLyrics(lines("Hello", "World"))).toBe(false);
  });
});

describe("shouldConvertPaste", () => {
  it("leaves single lines alone", () => {
    expect(shouldConvertPaste("A")).toBe(false);
    expect(shouldConvertPaste("Am F\n")).toBe(false);
  });

  it("converts pasted songs", () => {
    expect(shouldConvertPaste(lines("Am  F", "Hello"))).toBe(true);
  });
});

describe("normalizeSongContent", () => {
  it("converts songs saved as editor HTML", () => {
    const html = "<pre><code>[Intro]\nAm &amp; F\n</code></pre><p></p>";
    expect(normalizeSongContent(html)).toBe(lines("{c: Intro}", "[Am] & [F]"));
  });

  it("joins HTML paragraphs into lines", () => {
    expect(normalizeSongContent("<p>Am  F</p><p>C G</p>")).toBe(lines("[Am] [F]", "[C] [G]"));
  });

  it("leaves ChordPro alone", () => {
    const source = lines("{c: Verse}", "[Am]Hello  ");
    expect(normalizeSongContent(source)).toBe(source);
  });
});
