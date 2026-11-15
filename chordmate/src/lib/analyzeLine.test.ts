import { describe, it, expect } from "vitest";
import { detectChords, detectSectionHeader, isTabLine } from "./analyzeLine";

describe("detectChords", () => {
  const positiveExamples = [
    "Bm A D C# F# A# D# N.C.",
    "G x-x-5-4-3-x",
    "Ddim/F x-x-3-1-3-x",
    "Fm",
    "C F G7",
    "A#maj7 Dm7 G7 C/E",
    "F#7 Bm E7 Amaj7",
    "A C E",
    "|- C - C - C -|",
    "|-C-C-C-|",
    "|-C|C-C-|",
    "F#msus4/A",
    "F#mdim/A",
    "|(D#) | D# | D# | F | N.C.|",
    "B7sus2 Cmaj7 Bm7b5 B7+5",
    "Intro: Am F C G x2",
    "Dm7*   x02033",
    "Ebmaj9   (x68766)",
    "   Cmaj7          C7           C6          C add G#       C",
  ];

  it("detects positive chord lines", () => {
    for (const line of positiveExamples) {
      const result = detectChords(line);
      expect(result.isChordLine, `Failed for line: "${line}"`).toBe(true);
    }
  });

  const negativeExamples = [
    "This is a lyric line",
    "Hello world!",
    "I love programming",
    "Yesterday, all my troubles",
    "abc def ghi",
    "123 456 789",
    "A Donkey, A Dog, A D C A D C A D",
    "|[D#] | D# | D# | F | N.C.|",
    "Explain it to me",
  ];

  it("rejects negative lines", () => {
    for (const line of negativeExamples) {
      const result = detectChords(line);
      expect(result.isChordLine, `Failed for line: "${line}"`).toBe(false);
    }
  });
});

describe("detectSectionHeader", () => {
  const positiveExamples = ["[ ]", "[Chorus]", "[Verse 3]", "[Pre-Chorus 3]", "[Outro/Riff]"];

  it("detects positive section headers", () => {
    for (const line of positiveExamples) {
      expect(detectSectionHeader(line), `Failed for line: "${line}"`).toBe(true);
    }
  });

  const negativeExamples = ["[]", "", "[foo", "[SECTION]X"];

  it("rejects negative section headers", () => {
    for (const line of negativeExamples) {
      expect(detectSectionHeader(line), `Failed for line: "${line}"`).toBe(false);
    }
  });
});

describe("detectChords tokens", () => {
  it("classifies chords, annotations and other tokens with their columns", () => {
    const { tokens } = detectChords("Intro: Am  x-x-0 x2");
    expect(tokens.map(({ start, text, kind }) => [start, text, kind])).toEqual([
      [0, "Intro:", "annotation"],
      [7, "Am", "chord"],
      [11, "x", "other"],
      [13, "x", "other"],
      [15, "0", "other"],
      [17, "x2", "annotation"],
    ]);
  });
});

describe("isTabLine", () => {
  it("detects tablature", () => {
    expect(isTabLine("e|-------7-8-10/12\\10~|")).toBe(true);
    expect(isTabLine("D|--------------|  repeat")).toBe(true);
  });

  it("rejects bar notation of chords", () => {
    expect(isTabLine("| D    | D    | G    | Gm   | x2")).toBe(false);
    expect(isTabLine("|- C - C - C -|")).toBe(false);
  });
});
