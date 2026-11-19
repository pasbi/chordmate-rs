import { useEffect, useState } from "react";
import { type Bookmarks, LAST_PLAY_START_LABEL } from "../hooks/useBookmarks";
import { isTypingTarget } from "../lib/isTypingTarget";
import type Bookmark from "../types/Bookmark";
import {
  type BookmarkOverlay,
  bookmarkName,
  formatPosition,
  JUMP_TARGET_TEXT_CLASSES,
  MIN_LOOP_MS,
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

/** An arrow up to a bar: playback goes up to here, then back to the bookmark. */
function LoopEndIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 8h9M8 4.5 11.5 8 8 11.5M14 3v10" />
    </svg>
  );
}

/** The time of a bookmark, with its loop end if it has one. */
function bookmarkSpan(bookmark: Bookmark) {
  const start = formatPosition(bookmark.positionMs);
  return bookmark.endMs === null ? start : `${start}–${formatPosition(bookmark.endMs)}`;
}

/**
 * One entry of the bookmark menu: choosing it selects it; a bookmark also has ✎ to edit it, the
 * touch-friendly way to its editor besides a long press on its marker.
 */
function BookmarkMenuEntry({
  name,
  time,
  isActive,
  onSelect,
  onEdit,
}: {
  /** null for an unnamed bookmark. */
  name: string | null;
  time: string;
  isActive: boolean;
  onSelect: () => void;
  /** null for the last play start, which can't be edited. */
  onEdit: (() => void) | null;
}) {
  return (
    <div className="flex items-stretch">
      <button
        type="button"
        role="menuitemradio"
        aria-checked={isActive}
        onClick={onSelect}
        className={`${MENU_ITEM_CLASSES} flex flex-1 items-center gap-3`}
      >
        <span className={`w-3 ${JUMP_TARGET_TEXT_CLASSES}`} aria-hidden="true">
          {isActive ? "●" : ""}
        </span>
        <span
          className={`flex-1 truncate max-w-56 ${
            name === null ? "italic text-gray-500 dark:text-gray-400" : ""
          }`}
        >
          {name ?? "Unnamed"}
        </span>
        <span className="text-sm tabular-nums text-gray-600 dark:text-gray-400">{time}</span>
      </button>
      {onEdit ? (
        <button
          type="button"
          role="menuitem"
          title="Rename, shift or delete"
          aria-label={`Edit “${name ?? time}”`}
          onClick={onEdit}
          className="w-11 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-gray-700"
        >
          ✎
        </button>
      ) : (
        <span className="w-11" />
      )}
    </div>
  );
}

/** Lists ↺'s possible targets; choosing one selects it, ✎ edits a bookmark. */
function BookmarkMenu({
  bookmarks,
  lastPlayStartMs,
  anchor,
  onSelect,
  onEdit,
  onClose,
}: {
  bookmarks: Bookmarks;
  lastPlayStartMs: number;
  anchor: DOMRect;
  onSelect: (bookmark: Bookmark | null) => void;
  onEdit: (bookmark: Bookmark) => void;
  onClose: () => void;
}) {
  // Opens below the ▾, extending toward the middle of the screen.
  const x = anchor.left < window.innerWidth / 2 ? anchor.left : anchor.right;
  const select = (bookmark: Bookmark | null) => {
    onSelect(bookmark);
    onClose();
  };
  return (
    <FloatingMenu x={x} y={anchor.bottom + 4} role="menu" label="Bookmarks" onClose={onClose}>
      <BookmarkMenuEntry
        name={`▶ ${LAST_PLAY_START_LABEL}`}
        time={formatPosition(lastPlayStartMs)}
        isActive={bookmarks.activeId === null}
        onSelect={() => select(null)}
        onEdit={null}
      />
      {bookmarks.bookmarks.map((bookmark) => (
        <BookmarkMenuEntry
          key={bookmark.id}
          name={bookmark.label || null}
          time={bookmarkSpan(bookmark)}
          isActive={bookmark.id === bookmarks.activeId}
          onSelect={() => select(bookmark)}
          // Replaces the menu with the editor.
          onEdit={() => onEdit(bookmark)}
        />
      ))}
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
 * Adding a bookmark (🔖+, key B), setting the active bookmark's loop end (⇥, key E), and jumping to
 * ↺'s target (↺, key R), with a menu to choose that target. Jumps go exactly to the mark: bookmarks can be placed precisely, so they are taken as
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
  onEdit,
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
  /** Opens a bookmark's editor. */
  onEdit: (bookmark: Bookmark) => void;
}) {
  const [adding, setAdding] = useState(false);
  const active = bookmarks.bookmarks.find((bookmark) => bookmark.id === bookmarks.activeId) ?? null;

  const addHere = async () => {
    if (adding) {
      return;
    }
    setAdding(true);
    try {
      const added = await bookmarks.add(positionMs, "", null);
      bookmarks.setActiveId(added.id);
    } catch (err) {
      console.error(err);
      window.alert("Adding the bookmark failed.");
    } finally {
      setAdding(false);
    }
  };

  const jumpToActive = () => onJump(active ? active.positionMs : lastPlayStartMs);

  // A loop end needs some passage after the bookmark to close.
  const canSetLoopEnd = active !== null && positionMs >= active.positionMs + MIN_LOOP_MS;
  const setLoopEndHere = () => {
    if (!active || !canSetLoopEnd) {
      return;
    }
    bookmarks.update({ ...active, endMs: positionMs }).catch((err: unknown) => {
      console.error(err);
      window.alert("Setting the loop end failed.");
    });
  };

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
        case "e":
          setLoopEndHere();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const jumpTitle = active
    ? `Back to “${bookmarkName(active)}” (R)`
    : `Back to where Play was last pressed, ${formatPosition(lastPlayStartMs)} (R)`;

  const loopEndTitle = !active
    ? ""
    : !canSetLoopEnd
      ? `To set the loop end of “${bookmarkName(active)}”, play past it (E)`
      : `${active.endMs === null ? "Set" : "Move"} the loop end of “${bookmarkName(active)}” here: playback returns to it from here (E)`;

  return (
    <div className="relative flex items-center gap-1">
      <ControlButton
        variant="secondary"
        title="Add bookmark here (B)"
        disabled={false}
        onClick={addHere}
      >
        <BookmarkIcon />+
      </ControlButton>
      {active && (
        <ControlButton
          variant="secondary"
          title={loopEndTitle}
          disabled={!canSetLoopEnd}
          onClick={setLoopEndHere}
        >
          <span className={JUMP_TARGET_TEXT_CLASSES}>
            <LoopEndIcon />
          </span>
        </ControlButton>
      )}
      <SplitControlButton
        title={jumpTitle}
        onClick={jumpToActive}
        menuTitle="Choose bookmark"
        menuOpen={overlay?.kind === "menu"}
        onOpenMenu={(anchor) =>
          onOverlayChange(overlay?.kind === "menu" ? null : { kind: "menu", anchor })
        }
      >
        <span className={`text-2xl leading-none ${JUMP_TARGET_TEXT_CLASSES}`}>↺</span>
      </SplitControlButton>
      {overlay?.kind === "menu" && (
        <BookmarkMenu
          bookmarks={bookmarks}
          lastPlayStartMs={lastPlayStartMs}
          anchor={overlay.anchor}
          onSelect={onSelect}
          onEdit={onEdit}
          onClose={() => onOverlayChange(null)}
        />
      )}
      {bookmarks.lastRemoved && (
        <UndoDeleteNote deleted={bookmarks.lastRemoved} bookmarks={bookmarks} />
      )}
    </div>
  );
}
