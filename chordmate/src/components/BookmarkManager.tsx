import { type ReactNode, useState } from "react";
import { type Bookmarks, LAST_PLAY_START_LABEL } from "../hooks/useBookmarks";
import { formatTime, type Milliseconds } from "../lib/time";
import type Bookmark from "../types/Bookmark";
import Button from "./Button";
import { INPUT_CLASSES } from "./inputClasses";
import { Modal } from "./Modal";

/** How far one press of − or + shifts a bookmark. */
const SHIFT_STEP_MS = 250;

/** Shows tenths, since a shift step is a fraction of a second. */
function formatPrecise(positionMs: number) {
  const tenths = Math.floor((positionMs % 1000) / 100);
  return `${formatTime(positionMs as Milliseconds)}.${tenths}`;
}

function SmallButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="h-9 min-w-9 px-1.5 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 focus-visible:outline-2 focus-visible:outline-blue-500"
    >
      {children}
    </button>
  );
}

/** The bookmark's label, saved when the field is left or Enter is pressed. */
function LabelInput({
  bookmark,
  onRename,
}: {
  bookmark: Bookmark;
  onRename: (label: string) => void;
}) {
  const [draft, setDraft] = useState(bookmark.label);
  const commit = () => {
    const label = draft.trim();
    if (label !== bookmark.label) {
      onRename(label);
    }
  };
  return (
    <input
      type="text"
      aria-label="Bookmark name"
      value={draft}
      placeholder="Untitled"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      className={`${INPUT_CLASSES} min-w-0 flex-1`}
    />
  );
}

function ActiveRadio({
  checked,
  label,
  onSelect,
}: {
  checked: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <input
      type="radio"
      name="active-bookmark"
      title="Jump here with ↺"
      aria-label={`Jump to ${label} with ↺`}
      checked={checked}
      onChange={onSelect}
      className="w-4 h-4 shrink-0 accent-blue-500"
    />
  );
}

type Deleted = { bookmark: Bookmark; wasActive: boolean };

/**
 * Lists the bookmarks of the song's current track: choose the active one, rename, shift (each
 * shift plays from the new position), listen from the exact mark, delete (with undo).
 */
export function BookmarkManager({
  bookmarks,
  durationMs,
  lastPlayStartMs,
  onListen,
  onClose,
}: {
  bookmarks: Bookmarks;
  durationMs: number;
  lastPlayStartMs: number;
  /** Plays from a position in the song's track. */
  onListen: (positionMs: number) => void;
  onClose: () => void;
}) {
  const [deleted, setDeleted] = useState<Deleted | null>(null);

  const report = (action: string) => (err: unknown) => {
    console.error(err);
    window.alert(`${action} the bookmark failed.`);
  };

  const shift = (bookmark: Bookmark, deltaMs: number) => {
    const upperLimit = durationMs > 0 ? durationMs : Number.POSITIVE_INFINITY;
    const positionMs = Math.min(Math.max(bookmark.positionMs + deltaMs, 0), upperLimit);
    bookmarks.update({ ...bookmark, positionMs }).catch(report("Shifting"));
    onListen(positionMs);
  };

  const remove = (bookmark: Bookmark) => {
    const wasActive = bookmark.id === bookmarks.activeId;
    bookmarks
      .remove(bookmark)
      .then(() => setDeleted({ bookmark, wasActive }))
      .catch(report("Deleting"));
  };

  const undoDelete = async () => {
    if (!deleted) {
      return;
    }
    setDeleted(null);
    try {
      const restored = await bookmarks.add(deleted.bookmark.positionMs, deleted.bookmark.label);
      if (deleted.wasActive) {
        bookmarks.setActiveId(restored.id);
      }
    } catch (err) {
      report("Restoring")(err);
    }
  };

  return (
    <Modal label="Bookmarks" onClose={onClose} className="max-w-lg">
      <div className="p-4 flex flex-col gap-3 min-h-0">
        <h2 className="text-lg font-semibold">Bookmarks</h2>
        <ul className="flex flex-col gap-2 overflow-y-auto min-h-0">
          <li className="flex items-center gap-2 h-10">
            <ActiveRadio
              checked={bookmarks.activeId === null}
              label={LAST_PLAY_START_LABEL}
              onSelect={() => bookmarks.setActiveId(null)}
            />
            <span className="flex-1 min-w-0 truncate px-2">▶ {LAST_PLAY_START_LABEL}</span>
            {/* Empty slots keep the columns aligned with the bookmarks, which can be shifted
                and deleted. */}
            <div className="flex items-center gap-1">
              <span className="w-9" />
              <span className="min-w-[6ch] text-center text-sm tabular-nums">
                {formatPrecise(lastPlayStartMs)}
              </span>
              <span className="w-9" />
              <SmallButton title="Listen" onClick={() => onListen(lastPlayStartMs)}>
                ▶
              </SmallButton>
              <span className="w-9" />
            </div>
          </li>
          {bookmarks.bookmarks.map((bookmark) => (
            <li key={bookmark.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <ActiveRadio
                checked={bookmark.id === bookmarks.activeId}
                label={bookmark.label || "Untitled"}
                onSelect={() => bookmarks.setActiveId(bookmark.id)}
              />
              <LabelInput
                bookmark={bookmark}
                onRename={(label) =>
                  bookmarks.update({ ...bookmark, label }).catch(report("Renaming"))
                }
              />
              <div className="flex items-center gap-1">
                <SmallButton
                  title={`${SHIFT_STEP_MS / 1000} s earlier`}
                  onClick={() => shift(bookmark, -SHIFT_STEP_MS)}
                >
                  −
                </SmallButton>
                <span className="min-w-[6ch] text-center text-sm tabular-nums">
                  {formatPrecise(bookmark.positionMs)}
                </span>
                <SmallButton
                  title={`${SHIFT_STEP_MS / 1000} s later`}
                  onClick={() => shift(bookmark, SHIFT_STEP_MS)}
                >
                  +
                </SmallButton>
                <SmallButton title="Listen" onClick={() => onListen(bookmark.positionMs)}>
                  ▶
                </SmallButton>
                <SmallButton title="Delete" onClick={() => remove(bookmark)}>
                  🗑
                </SmallButton>
              </div>
            </li>
          ))}
        </ul>
        {bookmarks.bookmarks.length === 0 && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No bookmarks yet. Add one while playing with 🔖+ or the B key.
          </p>
        )}
        {deleted && (
          <div className="flex items-center gap-2 text-sm">
            <span className="flex-1 min-w-0 truncate">
              Deleted “{deleted.bookmark.label || "Untitled"}”.
            </span>
            <Button variant="secondary" onClick={undoDelete}>
              Undo
            </Button>
          </div>
        )}
        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
