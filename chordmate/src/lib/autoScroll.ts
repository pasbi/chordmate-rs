/**
 * Auto-scroll: where the sheet should be scrolled for a playback position. Anchored sections tie
 * a heading to the time its section starts; between them, and from the start to the first and
 * from the last to the end, the sheet glides evenly. Without anchors, the sheet's scroll range
 * simply follows the song's progress.
 */
import type { SheetLine } from "./chordPro.ts";
import { formatTime, type Milliseconds } from "./time.ts";

/** A section of a sheet: its heading's text and which occurrence of that text it is (from 1). */
export interface SectionKey {
  heading: string;
  occurrence: number;
}

/** The key as one string, e.g. for a DOM attribute or a map. */
export function sectionKeyString({ heading, occurrence }: SectionKey) {
  return `${occurrence}:${heading}`;
}

/** The section key of each heading line, by its index in `lines`. */
export function headingKeys(lines: SheetLine[]) {
  const seen = new Map<string, number>();
  const keys = new Map<number, SectionKey>();
  lines.forEach((line, index) => {
    if (line.kind !== "heading") {
      return;
    }
    const occurrence = (seen.get(line.text) ?? 0) + 1;
    seen.set(line.text, occurrence);
    keys.set(index, { heading: line.text, occurrence });
  });
  return keys;
}

/** The label of a button that anchors a section to the playback position (null: not loaded). */
export function anchorToLabel(positionMs: number | null) {
  return `Anchor to ${positionMs === null ? "–:––" : formatTime(positionMs as Milliseconds)}`;
}

/** A point of the scroll path: at `positionMs`, the sheet is scrolled to `scrollTop`. */
export interface ScrollPoint {
  positionMs: number;
  scrollTop: number;
}

/** The scroll position at `positionMs` along a path sorted by time, held at its ends. */
function along(positionMs: number, path: ScrollPoint[]) {
  const nextIndex = path.findIndex((point) => point.positionMs > positionMs);
  if (nextIndex === -1) {
    return path[path.length - 1].scrollTop;
  }
  if (nextIndex === 0) {
    return path[0].scrollTop;
  }
  const from = path[nextIndex - 1];
  const to = path[nextIndex];
  const progress = (positionMs - from.positionMs) / (to.positionMs - from.positionMs);
  return from.scrollTop + progress * (to.scrollTop - from.scrollTop);
}

/** A path from `start` at the song's start, through the anchors in time order, to `end`. */
function pathThrough(anchors: ScrollPoint[], durationMs: number, start: number, end: number) {
  return [
    { positionMs: 0, scrollTop: start },
    ...anchors
      .filter((anchor) => anchor.positionMs > 0 && anchor.positionMs < durationMs)
      .sort((a, b) => a.positionMs - b.positionMs),
    { positionMs: durationMs, scrollTop: end },
  ];
}

/**
 * The scroll position for a playback position: along the path from the top at the song's start,
 * through the anchors (in time order), to the bottom at its end. Clamped to the scroll range.
 */
export function scrollTopAt(
  positionMs: number,
  durationMs: number,
  anchors: ScrollPoint[],
  maxScrollTop: number
) {
  const scrollTop = along(positionMs, pathThrough(anchors, durationMs, 0, maxScrollTop));
  return Math.min(Math.max(scrollTop, 0), maxScrollTop);
}

/** A heading in the sheet: how far down it is, and when its section starts if it is anchored. */
export interface SheetHeading {
  top: number;
  startMs: number | null;
}

/**
 * The index of the heading whose section plays at `positionMs`, or null before the first one.
 * An anchored section plays from its start; an unanchored one from when the music, gliding
 * evenly through the sheet's content between the anchors, reaches its heading.
 */
export function currentHeadingIndex(
  positionMs: number,
  durationMs: number,
  headings: SheetHeading[],
  contentHeight: number
) {
  const anchors = headings.flatMap(({ top, startMs }) =>
    startMs === null ? [] : [{ positionMs: startMs, scrollTop: top }]
  );
  const reached = along(positionMs, pathThrough(anchors, durationMs, 0, contentHeight));
  const index = headings
    .map(({ top, startMs }) => (startMs === null ? top <= reached : startMs <= positionMs))
    .lastIndexOf(true);
  return index === -1 ? null : index;
}
