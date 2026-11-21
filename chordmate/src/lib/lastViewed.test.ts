import { describe, expect, it } from "vitest";
import { lastViewedLabel } from "./lastViewed.ts";

/** Local time, months counted from 1. */
function at(year: number, month: number, day: number, hour: number) {
  return new Date(year, month - 1, day, hour);
}

function label(viewed: Date, now: Date) {
  return lastViewedLabel(viewed.getTime(), now);
}

// Wednesday, 2 December 2026; that week started on Monday, 30 November.
const NOW = at(2026, 12, 2, 18);

describe("lastViewedLabel", () => {
  it("counts calendar days, not 24-hour periods", () => {
    expect(label(at(2026, 12, 2, 0), NOW)).toBe("today");
    expect(label(at(2026, 12, 1, 23), NOW)).toBe("yesterday");
    expect(label(at(2026, 12, 2, 1), at(2026, 12, 2, 23))).toBe("today");
  });

  it("keeps a view early this week in this week, across the month's start", () => {
    expect(label(at(2026, 11, 30, 9), NOW)).toBe("this week");
  });

  it("puts last week's days in last week, also from the previous month", () => {
    expect(label(at(2026, 11, 29, 20), NOW)).toBe("last week");
    expect(label(at(2026, 11, 23, 8), NOW)).toBe("last week");
  });

  it("then counts elapsed weeks, months and years, across month and year boundaries", () => {
    expect(label(at(2026, 11, 22, 12), NOW)).toBe("2 weeks ago");
    expect(label(at(2026, 11, 4, 12), NOW)).toBe("4 weeks ago");
    expect(label(at(2026, 10, 25, 12), NOW)).toBe("1 month ago");
    expect(label(at(2026, 9, 3, 12), NOW)).toBe("2 months ago");
    expect(label(at(2026, 9, 2, 12), NOW)).toBe("3 months ago");
    expect(label(at(2025, 12, 3, 12), NOW)).toBe("11 months ago");
    expect(label(at(2025, 12, 2, 12), NOW)).toBe("1 year ago");
    expect(label(at(2023, 7, 1, 12), NOW)).toBe("3 years ago");
  });

  it("counts a view in the future as today", () => {
    expect(label(at(2026, 12, 3, 12), NOW)).toBe("today");
  });
});
