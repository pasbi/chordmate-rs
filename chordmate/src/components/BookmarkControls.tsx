import { useEffect, useState } from "react";
import { type Bookmarks, LAST_PLAY_START_LABEL } from "../hooks/useBookmarks";
import { isTypingTarget } from "../lib/isTypingTarget";
import { formatTime, type Milliseconds } from "../lib/time";
import type Bookmark from "../types/Bookmark";
import { BookmarkManager } from "./BookmarkManager";
import { FloatingMenu, MENU_ITEM_CLASSES } from "./ContextMenu";
import { ControlButton, SplitControlButton } from "./ControlButton";

/** What covers the player: the bookmark menu or the manager. Player shortcuts pause meanwhile. */
export type BookmarkOverlay = { kind: "menu"; anchor: DOMRect } | { kind: "manager" } | null;

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M4 1.5h8v13l-4-3-4 3z" />
    </svg>
  );
}

function formatPosition(positionMs: number) {
  return formatTime(positionMs as Milliseconds);
}

function activeBookmark(bookmarks: Bookmarks) {
  return bookmarks.bookmarks.find((bookmark) => bookmark.id === bookmarks.activeId) ?? null;
}

/** Colors ↺'s target wherever it is shown: its marker, its glyph, the active entry's dot. */
export const JUMP_TARGET_TEXT_CLASSES = "text-amber-600 dark:text-amber-400";

/** Points down at the position, for “Last play start” while it is ↺'s target. */
function PlayStartMarker() {
  return (
    <svg viewBox="0 0 10 8" className="w-2.5 h-2" fill="currentColor" aria-hidden="true">
      <path d="M0 0h10L5 8z" />
    </svg>
  );
}

/** The bookmark icon's shape, for the active bookmark. */
function ActiveBookmarkMarker() {
  return (
    <svg viewBox="0 0 8 10" className="w-2 h-2.5" fill="currentColor" aria-hidden="true">
      <path d="M0 0h8v10L4 7 0 10z" />
    </svg>
  );
}

/** The name shown for a bookmark, also when it has none. */
function bookmarkName(bookmark: Bookmark) {
  return bookmark.label || "Untitled";
}

/**
 * Markers in a strip just above the position slider, out of the thumb's reach: a gray dot per
 * bookmark, and an amber marker for ↺'s target, the active bookmark or the last play start.
 * Clicking a dot makes that bookmark active; hovering a marker shows its name.
 */
export function BookmarkMarkers({
  bookmarks,
  durationMs,
  lastPlayStartMs,
}: {
  bookmarks: Bookmarks;
  durationMs: number;
  lastPlayStartMs: number;
}) {
  if (durationMs <= 0) {
    return null;
  }
  // The thumb's center can't reach the slider's ends: it stays half a thumb (~16 px) away.
  const markerLeft = (positionMs: number) =>
    `calc(8px + (100% - 16px) * ${Math.min(positionMs / durationMs, 1)})`;
  // Each marker sits at the bottom of a box larger than itself, so that a small dot is still
  // easy to hit. The box only grows upward and sideways, never over the thumb below.
  const hitBoxClasses =
    "pointer-events-auto absolute bottom-0 -translate-x-1/2 w-5 h-4 flex items-end justify-center";
  const active = activeBookmark(bookmarks);
  return (
    // The strip ends a thumb's half-height above the track's center, where the thumb ends.
    <div className="pointer-events-none absolute inset-x-0 bottom-full mb-1 h-2">
      {bookmarks.bookmarks
        .filter((bookmark) => bookmark !== active)
        .map((bookmark) => (
          <button
            key={bookmark.id}
            type="button"
            title={`${bookmarkName(bookmark)} – click to jump here with ↺`}
            aria-label={`Make “${bookmarkName(bookmark)}” the bookmark ↺ jumps to`}
            onClick={() => bookmarks.setActiveId(bookmark.id)}
            style={{ left: markerLeft(bookmark.positionMs) }}
            className={`group rounded focus-visible:outline-2 focus-visible:outline-blue-500 ${hitBoxClasses}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 group-hover:scale-150 group-hover:bg-amber-500 dark:group-hover:bg-amber-400 transition-transform" />
          </button>
        ))}
      {/* Drawn last, so that no dot covers it. */}
      <div
        title={active ? bookmarkName(active) : LAST_PLAY_START_LABEL}
        style={{ left: markerLeft(active ? active.positionMs : lastPlayStartMs) }}
        className={`${hitBoxClasses} ${JUMP_TARGET_TEXT_CLASSES}`}
      >
        {active ? <ActiveBookmarkMarker /> : <PlayStartMarker />}
      </div>
    </div>
  );
}

function BookmarkMenu({
  bookmarks,
  lastPlayStartMs,
  anchor,
  onManage,
  onClose,
}: {
  bookmarks: Bookmarks;
  lastPlayStartMs: number;
  anchor: DOMRect;
  onManage: () => void;
  onClose: () => void;
}) {
  // Opens below the ▾, extending toward the middle of the screen.
  const x = anchor.left < window.innerWidth / 2 ? anchor.left : anchor.right;
  const select = (id: number | null) => {
    bookmarks.setActiveId(id);
    onClose();
  };
  const entries = [
    { id: null, label: `▶ ${LAST_PLAY_START_LABEL}`, positionMs: lastPlayStartMs },
    ...bookmarks.bookmarks,
  ];
  return (
    <FloatingMenu x={x} y={anchor.bottom + 4} label="Bookmarks" onClose={onClose}>
      {entries.map((entry) => (
        <button
          key={entry.id ?? "lastPlayStart"}
          type="button"
          role="menuitemradio"
          aria-checked={entry.id === bookmarks.activeId}
          onClick={() => select(entry.id)}
          className={`${MENU_ITEM_CLASSES} flex items-center gap-3`}
        >
          <span className={`w-3 ${JUMP_TARGET_TEXT_CLASSES}`} aria-hidden="true">
            {entry.id === bookmarks.activeId ? "●" : ""}
          </span>
          <span className="flex-1 truncate max-w-56">{entry.label || "Untitled"}</span>
          <span className="text-sm tabular-nums text-gray-600 dark:text-gray-400">
            {formatPosition(entry.positionMs)}
          </span>
        </button>
      ))}
      <div role="separator" className="my-1 border-t border-gray-200 dark:border-gray-700" />
      <button type="button" role="menuitem" onClick={onManage} className={MENU_ITEM_CLASSES}>
        Manage bookmarks…
      </button>
    </FloatingMenu>
  );
}

/**
 * Adding a bookmark (🔖+, key B) and jumping to the active one (↺, key R), with a menu to choose
 * the active bookmark and open the manager. Jumps go exactly to the mark: bookmarks can be placed
 * precisely, so they are taken as meant.
 */
export function BookmarkControls({
  bookmarks,
  positionMs,
  durationMs,
  lastPlayStartMs,
  enableShortcuts,
  overlay,
  onOverlayChange,
  onJump,
}: {
  bookmarks: Bookmarks;
  positionMs: number;
  durationMs: number;
  lastPlayStartMs: number;
  enableShortcuts: boolean;
  overlay: BookmarkOverlay;
  onOverlayChange: (overlay: BookmarkOverlay) => void;
  /** Moves playback to a position in this song's track and plays. */
  onJump: (positionMs: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const active = activeBookmark(bookmarks);

  const addHere = async () => {
    if (adding) {
      return;
    }
    setAdding(true);
    try {
      const added = await bookmarks.add(positionMs, formatPosition(positionMs));
      bookmarks.setActiveId(added.id);
    } catch (err) {
      console.error(err);
      window.alert("Adding the bookmark failed.");
    } finally {
      setAdding(false);
    }
  };

  const jumpToActive = () => onJump(active ? active.positionMs : lastPlayStartMs);

  // Subscribes anew on every render, so that the handler always sees the current position.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!enableShortcuts || isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      switch (e.key.toLowerCase()) {
        case "b":
          if (!e.repeat) {
            void addHere();
          }
          break;
        case "r":
          jumpToActive();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const jumpTitle = active
    ? `Back to “${bookmarkName(active)}” (R)`
    : `Back to where Play was last pressed, ${formatPosition(lastPlayStartMs)} (R)`;

  return (
    <div className="flex items-center gap-1">
      <ControlButton variant="secondary" title="Add bookmark here (B)" onClick={addHere}>
        <BookmarkIcon />+
      </ControlButton>
      <SplitControlButton
        title={jumpTitle}
        onClick={jumpToActive}
        menuTitle="Choose bookmark"
        menuOpen={overlay?.kind === "menu"}
        onOpenMenu={(anchor) =>
          onOverlayChange(overlay?.kind === "menu" ? null : { kind: "menu", anchor })
        }
      >
        <span className={`text-base leading-none ${JUMP_TARGET_TEXT_CLASSES}`}>↺</span>
      </SplitControlButton>
      {overlay?.kind === "menu" && (
        <BookmarkMenu
          bookmarks={bookmarks}
          lastPlayStartMs={lastPlayStartMs}
          anchor={overlay.anchor}
          onManage={() => onOverlayChange({ kind: "manager" })}
          onClose={() => onOverlayChange(null)}
        />
      )}
      {overlay?.kind === "manager" && (
        <BookmarkManager
          bookmarks={bookmarks}
          durationMs={durationMs}
          lastPlayStartMs={lastPlayStartMs}
          onListen={onJump}
          onClose={() => onOverlayChange(null)}
        />
      )}
    </div>
  );
}
