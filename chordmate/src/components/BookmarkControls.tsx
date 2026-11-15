import { useEffect, useState } from "react";
import { type Bookmarks, LAST_PLAY_START_LABEL } from "../hooks/useBookmarks";
import { isTypingTarget } from "../lib/isTypingTarget";
import { formatTime, type Milliseconds } from "../lib/time";
import type Bookmark from "../types/Bookmark";
import { BookmarkManager } from "./BookmarkManager";
import { FloatingMenu, MENU_ITEM_CLASSES } from "./ContextMenu";
import { ControlButton, SplitControlButton } from "./ControlButton";

/** How far before a bookmark a jump starts, to get the hands ready. */
const PRE_ROLL_MS = 2000;

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

/** Faint marks on the position slider where the bookmarks are; the active one is stronger. */
export function BookmarkTicks({
  bookmarks,
  durationMs,
}: {
  bookmarks: Bookmarks;
  durationMs: number;
}) {
  if (durationMs <= 0) {
    return null;
  }
  // The slider's thumb center can't reach its edges: it moves within half a thumb (~16 px) from
  // either end.
  const tickLeft = (bookmark: Bookmark) =>
    `calc(8px + (100% - 16px) * ${Math.min(bookmark.positionMs / durationMs, 1)})`;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {bookmarks.bookmarks.map((bookmark) => (
        <div
          key={bookmark.id}
          style={{ left: tickLeft(bookmark) }}
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full ${
            bookmark.id === bookmarks.activeId
              ? "bg-blue-500/80 dark:bg-blue-400/80"
              : "bg-gray-400/60 dark:bg-gray-500/70"
          }`}
        />
      ))}
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
          <span className="w-3 text-blue-600 dark:text-blue-400" aria-hidden="true">
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
 * the active bookmark and open the manager. A jump to a bookmark starts a bit earlier; a jump to
 * where Play was last pressed starts exactly there.
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

  const jumpToActive = () =>
    onJump(active ? Math.max(active.positionMs - PRE_ROLL_MS, 0) : lastPlayStartMs);

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
    ? `Back to “${active.label || "Untitled"}” (R)`
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
        <span className="text-base leading-none">↺</span>
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
