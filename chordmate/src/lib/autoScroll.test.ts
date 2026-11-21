import { describe, expect, it } from "vitest";
import { currentHeadingIndex, headingKeys, scrollTopAt } from "./autoScroll.ts";
import { parseChordPro } from "./chordPro.ts";

describe("headingKeys", () => {
  it("counts each heading's occurrences", () => {
    const lines = parseChordPro("{c: Verse}\n[Am]la\n{c: Chorus}\n[C]la\n{c: Verse}\n{c: Chorus}");
    expect([...headingKeys(lines).values()]).toEqual([
      { heading: "Verse", occurrence: 1 },
      { heading: "Chorus", occurrence: 1 },
      { heading: "Verse", occurrence: 2 },
      { heading: "Chorus", occurrence: 2 },
    ]);
  });
});

describe("scrollTopAt", () => {
  const DURATION = 200_000;
  const MAX = 1000;

  it("follows the song's progress without anchors", () => {
    expect(scrollTopAt(0, DURATION, [], MAX)).toBe(0);
    expect(scrollTopAt(50_000, DURATION, [], MAX)).toBe(250);
    expect(scrollTopAt(DURATION, DURATION, [], MAX)).toBe(MAX);
  });

  it("glides between anchors, from the top and to the bottom", () => {
    const anchors = [
      { positionMs: 100_000, scrollTop: 600 },
      { positionMs: 20_000, scrollTop: 100 },
    ];
    expect(scrollTopAt(10_000, DURATION, anchors, MAX)).toBe(50);
    expect(scrollTopAt(20_000, DURATION, anchors, MAX)).toBe(100);
    expect(scrollTopAt(60_000, DURATION, anchors, MAX)).toBe(350);
    expect(scrollTopAt(150_000, DURATION, anchors, MAX)).toBe(800);
  });

  it("stays within the scroll range", () => {
    expect(scrollTopAt(30_000, DURATION, [{ positionMs: 30_000, scrollTop: 5000 }], MAX)).toBe(MAX);
    expect(scrollTopAt(-1000, DURATION, [], MAX)).toBe(0);
    expect(scrollTopAt(DURATION + 1000, DURATION, [], MAX)).toBe(MAX);
  });
});

describe("currentHeadingIndex", () => {
  const DURATION = 200_000;
  const HEIGHT = 2000;

  it("estimates unanchored sections from the song's progress", () => {
    const headings = [
      { top: 0, startMs: null },
      { top: 1000, startMs: null },
    ];
    expect(currentHeadingIndex(0, DURATION, headings, HEIGHT)).toBe(0);
    expect(currentHeadingIndex(99_000, DURATION, headings, HEIGHT)).toBe(0);
    expect(currentHeadingIndex(100_000, DURATION, headings, HEIGHT)).toBe(1);
  });

  it("starts anchored sections at their anchors, and glides between them", () => {
    const headings = [
      { top: 100, startMs: 20_000 },
      { top: 300, startMs: null },
      { top: 500, startMs: 60_000 },
    ];
    expect(currentHeadingIndex(10_000, DURATION, headings, HEIGHT)).toBeNull();
    expect(currentHeadingIndex(20_000, DURATION, headings, HEIGHT)).toBe(0);
    expect(currentHeadingIndex(39_000, DURATION, headings, HEIGHT)).toBe(0);
    expect(currentHeadingIndex(40_000, DURATION, headings, HEIGHT)).toBe(1);
    expect(currentHeadingIndex(60_000, DURATION, headings, HEIGHT)).toBe(2);
  });
});
