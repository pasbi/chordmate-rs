import { describe, it, expect } from "vitest";
import analyzeLine from "./analyzeLine";

describe("analyzeLine", () => {
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
  ];

  it("detects positive chord lines", () => {
    for (const line of positiveExamples) {
      const result = analyzeLine(line);
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
  ];

  it("rejects negative lines", () => {
    for (const line of negativeExamples) {
      const result = analyzeLine(line);
      expect(result.isChordLine, `Failed for line: "${line}"`).toBe(false);
    }
  });
});
