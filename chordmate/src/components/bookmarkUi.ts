import { formatTime, type Milliseconds } from "../lib/time";
import type Bookmark from "../types/Bookmark";

/**
 * What covers the player: the bookmark menu below ▾, or the editor of one bookmark at a marker.
 * The player's keyboard shortcuts pause meanwhile.
 */
export type BookmarkOverlay =
  | { kind: "menu"; anchor: DOMRect }
  | { kind: "editor"; bookmarkId: number; x: number; y: number }
  | null;

/** Colors ↺'s target wherever it is shown: its marker and name, ↺ itself, the menu's dot. */
export const JUMP_TARGET_TEXT_CLASSES = "text-amber-600 dark:text-amber-400";

export function formatPosition(positionMs: number) {
  return formatTime(positionMs as Milliseconds);
}

/**
 * The name shown for a bookmark: its label, or else its current time. Bookmarks start without a
 * label, so that the time shown stays right when the bookmark is shifted. Labels need not be
 * unique; bookmarks are told apart by their ids.
 */
export function bookmarkName(bookmark: Bookmark) {
  return bookmark.label || formatPosition(bookmark.positionMs);
}

/** With tenths of a second, for shifting a bookmark in fractions of a second. */
export function formatPrecisePosition(positionMs: number) {
  const tenths = Math.floor((positionMs % 1000) / 100);
  return `${formatPosition(positionMs)}.${tenths}`;
}

/** How far one press of − or + shifts a bookmark or a section's start. */
export const SHIFT_STEP_MS = 250;

/** The shortest passage a loop end may close, after the bookmark's position. */
export const MIN_LOOP_MS = 500;

/** Listening to a loop end starts this much before it, so that the end and the jump back are heard. */
export const LOOP_END_LEAD_MS = 2000;

/** Where to listen to a bookmark's loop end from: a little before it, but not before the bookmark. */
export function loopEndListenPosition(bookmark: Bookmark & { endMs: number }) {
  return Math.max(bookmark.endMs - LOOP_END_LEAD_MS, bookmark.positionMs);
}
