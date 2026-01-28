import { describe, it, expect } from "vitest";
import { detectChords, detectSectionHeader } from "./analyzeLine";

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

  it("detects positive section headers", () => {
    for (const line of negativeExamples) {
      expect(detectSectionHeader(line), `Failed for line: "${line}"`).toBe(false);
    }
  });
});
