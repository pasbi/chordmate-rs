import { useEffect, useState } from "react";
import { type Bookmarks, LAST_PLAY_START_LABEL } from "../hooks/useBookmarks";
import { isTypingTarget } from "../lib/isTypingTarget";
import type Bookmark from "../types/Bookmark";
import {
  type BookmarkOverlay,
  bookmarkName,
  formatPosition,
  JUMP_TARGET_TEXT_CLASSES,
} from "./bookmarkUi";
import { FloatingMenu, MENU_ITEM_CLASSES } from "./ContextMenu";
import { ControlButton, SplitControlButton } from "./ControlButton";

/** How long the note to undo a deletion stays. */
const UNDO_NOTE_MS = 6000;

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M4 1.5h8v13l-4-3-4 3z" />
    </svg>
  );
}

/** Lists ↺'s possible targets; choosing one selects it. Explains how to edit bookmarks. */
function BookmarkMenu({
  bookmarks,
  lastPlayStartMs,
  anchor,
  onSelect,
  onClose,
}: {
  bookmarks: Bookmarks;
  lastPlayStartMs: number;
  anchor: DOMRect;
  onSelect: (bookmark: Bookmark | null) => void;
  onClose: () => void;
}) {
  // Opens below the ▾, extending toward the middle of the screen.
  const x = anchor.left < window.innerWidth / 2 ? anchor.left : anchor.right;
  const entries = [
    { bookmark: null, name: `▶ ${LAST_PLAY_START_LABEL}`, positionMs: lastPlayStartMs },
    ...bookmarks.bookmarks.map((bookmark) => ({
      bookmark,
      // The time column shows the time; an unnamed bookmark doesn't repeat it as its name.
      name: bookmark.label,
      positionMs: bookmark.positionMs,
    })),
  ];
  return (
    <FloatingMenu x={x} y={anchor.bottom + 4} role="menu" label="Bookmarks" onClose={onClose}>
      {entries.map(({ bookmark, name, positionMs }) => {
        const isActive = (bookmark?.id ?? null) === bookmarks.activeId;
        return (
          <button
            key={bookmark?.id ?? "lastPlayStart"}
            type="button"
            role="menuitemradio"
            aria-checked={isActive}
            onClick={() => {
              onSelect(bookmark);
              onClose();
            }}
            className={`${MENU_ITEM_CLASSES} flex items-center gap-3`}
          >
            <span className={`w-3 ${JUMP_TARGET_TEXT_CLASSES}`} aria-hidden="true">
              {isActive ? "●" : ""}
            </span>
            <span className="flex-1 truncate max-w-56">{name}</span>
            <span className="text-sm tabular-nums text-gray-600 dark:text-gray-400">
              {formatPosition(positionMs)}
            </span>
          </button>
        );
      })}
      <p className="mt-1 px-4 pt-2 pb-1 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
        To rename, shift or delete a bookmark, right-click or long-press its marker on the slider.
      </p>
    </FloatingMenu>
  );
}

/** Offers to restore a just deleted bookmark for a few seconds. */
function UndoDeleteNote({ deleted, bookmarks }: { deleted: Bookmark; bookmarks: Bookmarks }) {
  const { forgetRemoved } = bookmarks;
  useEffect(() => {
    const timeout = setTimeout(forgetRemoved, UNDO_NOTE_MS);
    return () => clearTimeout(timeout);
  }, [deleted, forgetRemoved]);
  return (
    <div
      role="status"
      className="absolute right-0 top-full mt-1 z-20 flex items-center gap-2 whitespace-nowrap rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-3 pr-1 py-1 text-sm"
    >
      <span className="max-w-48 truncate">Deleted “{bookmarkName(deleted)}”.</span>
      <button
        type="button"
        onClick={() =>
          bookmarks.undoRemove().catch((err) => {
            console.error(err);
            window.alert("Restoring the bookmark failed.");
          })
        }
        className="px-2 py-1 rounded font-medium text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        Undo
      </button>
    </div>
  );
}

/**
 * Adding a bookmark (🔖+, key B) and jumping to ↺'s target (↺, key R), with a menu to choose that
 * target. Jumps go exactly to the mark: bookmarks can be placed precisely, so they are taken as
 * meant.
 */
export function BookmarkControls({
  bookmarks,
  positionMs,
  lastPlayStartMs,
  enableShortcuts,
  overlay,
  onOverlayChange,
  onSelect,
  onJump,
}: {
  bookmarks: Bookmarks;
  positionMs: number;
  lastPlayStartMs: number;
  enableShortcuts: boolean;
  overlay: BookmarkOverlay;
  onOverlayChange: (overlay: BookmarkOverlay) => void;
  /** Makes a bookmark, or the last play start for null, ↺'s target. */
  onSelect: (bookmark: Bookmark | null) => void;
  /** Moves playback to a position in this song's track and plays. */
  onJump: (positionMs: number) => void;
}) {
  const [adding, setAdding] = useState(false);
  const active = bookmarks.bookmarks.find((bookmark) => bookmark.id === bookmarks.activeId) ?? null;

  const addHere = async () => {
    if (adding) {
      return;
    }
    setAdding(true);
    try {
      const added = await bookmarks.add(positionMs, "");
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
    <div className="relative flex items-center gap-1">
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
          onSelect={onSelect}
          onClose={() => onOverlayChange(null)}
        />
      )}
      {bookmarks.lastRemoved && (
        <UndoDeleteNote deleted={bookmarks.lastRemoved} bookmarks={bookmarks} />
      )}
    </div>
  );
}
