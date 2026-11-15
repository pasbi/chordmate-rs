import { describe, expect, it } from "vitest";
import { analyzeSourceLine, isChordPro, parseChordPro, tidyChordPro } from "./chordPro";

describe("parseChordPro", () => {
  it("splits lyrics at chords", () => {
    expect(parseChordPro("I [Am]feel [F#m7/E]fine")).toEqual([
      {
        kind: "lyrics",
        segments: [
          { chord: null, lyrics: "I " },
          { chord: { text: "Am", isAnnotation: false }, lyrics: "feel " },
          { chord: { text: "F#m7/E", isAnnotation: false }, lyrics: "fine" },
        ],
      },
    ]);
  });

  it("parses annotations and chords without lyrics", () => {
    expect(parseChordPro("[C] [G][*x2]")).toEqual([
      {
        kind: "lyrics",
        segments: [
          { chord: { text: "C", isAnnotation: false }, lyrics: " " },
          { chord: { text: "G", isAnnotation: false }, lyrics: "" },
          { chord: { text: "x2", isAnnotation: true }, lyrics: "" },
        ],
      },
    ]);
  });

  it("shows comments and section starts as headings", () => {
    const source = [
      "{c: Verse 1}",
      "{comment:Intro}",
      "{start_of_chorus}",
      "{eoc}",
      "{sov: Verse 2}",
      "[Bridge]",
    ].join("\n");
    expect(parseChordPro(source)).toEqual([
      { kind: "heading", text: "Verse 1" },
      { kind: "heading", text: "Intro" },
      { kind: "heading", text: "Chorus" },
      { kind: "heading", text: "Verse 2" },
      { kind: "heading", text: "Bridge" },
    ]);
  });

  it("ignores metadata directives and keeps empty lines", () => {
    expect(parseChordPro("{title: Song}\n\n  ")).toEqual([{ kind: "empty" }, { kind: "empty" }]);
  });

  it("keeps tab blocks verbatim", () => {
    const source = "{start_of_tab: Riff}\n  [G]\ne|--3--|\n{eot}\nla";
    expect(parseChordPro(source)).toEqual([
      { kind: "heading", text: "Riff" },
      { kind: "tab", lines: ["  [G]", "e|--3--|"] },
      { kind: "lyrics", segments: [{ chord: null, lyrics: "la" }] },
    ]);
  });

  it("treats a lone bracketed chord as a chord, not a heading", () => {
    expect(parseChordPro("[Am]")[0].kind).toBe("lyrics");
  });
});

describe("analyzeSourceLine", () => {
  it("reports chord marks with their columns", () => {
    expect(analyzeSourceLine("a[C]b[*x2]")).toEqual({
      kind: "lyrics",
      marks: [
        { start: 1, end: 4, chord: { text: "C", isAnnotation: false } },
        { start: 5, end: 10, chord: { text: "x2", isAnnotation: true } },
      ],
    });
  });
});

describe("isChordPro", () => {
  it("detects ChordPro markup", () => {
    expect(isChordPro("[Am]Hello")).toBe(true);
    expect(isChordPro("{c: Chorus}\nla la")).toBe(true);
  });

  it("does not take section headers for chords", () => {
    expect(isChordPro("[Verse 1]\nAm  F\nHello there")).toBe(false);
  });
});

describe("tidyChordPro", () => {
  it("collapses runs of whitespace and trims lines", () => {
    expect(tidyChordPro("  [G]  It's  late   [C]  \n[Bm]   [E]  | [A] |")).toBe(
      "[G] It's late [C]\n[Bm] [E] | [A] |"
    );
  });

  it("keeps the spacing of lines without chords", () => {
    expect(tidyChordPro("Cmaj7      C7  H  \n  foo        bar  ")).toBe(
      "Cmaj7      C7  H\n  foo        bar"
    );
  });

  it("drops blank lines at the ends, after headings and when repeated", () => {
    const source = "\n \n{c: Intro}\n\n[Am]\n\n\n\n[Verse]\n \nla\n\n";
    expect(tidyChordPro(source)).toBe("{c: Intro}\n[Am]\n\n[Verse]\nla");
  });

  it("keeps blank lines after directives that show nothing", () => {
    expect(tidyChordPro("{title: Song}\n\nla")).toBe("{title: Song}\n\nla");
  });

  it("keeps tab blocks as they are", () => {
    const source = "{sot}\n G    D  \ne|--3--|\n\n{eot}\n  la  la";
    expect(tidyChordPro(source)).toBe("{sot}\n G    D\ne|--3--|\n\n{eot}\n  la  la");
  });
});
