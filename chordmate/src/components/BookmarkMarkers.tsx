import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { type Bookmarks, LAST_PLAY_START_LABEL } from "../hooks/useBookmarks";
import { useContextMenuTrigger } from "../hooks/useContextMenuTrigger";
import type Bookmark from "../types/Bookmark";
import {
  type BookmarkOverlay,
  bookmarkName,
  formatPosition,
  formatPrecisePosition,
  JUMP_TARGET_TEXT_CLASSES,
  loopEndListenPosition,
  MIN_LOOP_MS,
} from "./bookmarkUi";
import { FloatingMenu } from "./ContextMenu";
import { INPUT_CLASSES } from "./inputClasses";

/** How far one press of − or + shifts a bookmark. */
const SHIFT_STEP_MS = 250;

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

/**
 * A marker on the slider. A click selects it; a right-click or long press opens its editor, if it
 * has one. The button is larger than the marker it shows, so that a small dot is still easy to
 * hit; it grows only upward and sideways from the marker, never over the slider's thumb.
 */
function MarkerButton({
  left,
  title,
  label,
  onSelect,
  onEdit,
  className,
  children,
}: {
  left: string;
  title: string;
  label: string;
  onSelect: () => void;
  /** Opens the editor at a screen position; null for a marker that can't be edited. */
  onEdit: ((x: number, y: number) => void) | null;
  className: string;
  children: ReactNode;
}) {
  const editTrigger = useContextMenuTrigger((x, y) => onEdit?.(x, y));
  const triggerHandlers = onEdit ? editTrigger : null;
  return (
    <button
      type="button"
      title={title}
      aria-label={label}
      style={{ left }}
      {...triggerHandlers}
      onClick={(event) => {
        // A long press that opened the editor is no click.
        triggerHandlers?.onClick(event);
        if (!event.defaultPrevented) {
          onSelect();
        }
      }}
      // select-none and no touch callout: a long press opens the editor, not the browser's menu.
      className={`group pointer-events-auto absolute bottom-0 -translate-x-1/2 w-5 h-4 flex items-end justify-center rounded select-none [-webkit-touch-callout:none] focus-visible:outline-2 focus-visible:outline-blue-500 ${className}`}
    >
      {children}
    </button>
  );
}

/** A bar closing the passage on its left, for the active bookmark's loop end. */
function LoopEndMarker() {
  return (
    <svg viewBox="0 0 6 10" className="w-1.5 h-2.5" fill="currentColor" aria-hidden="true">
      <path d="M4 0h2v10H0V8h4z" />
    </svg>
  );
}

/** The active bookmark's name beside its marker, on the side with more room. */
function ActiveName({ name, onRightHalf }: { name: string; onRightHalf: boolean }) {
  return (
    <span
      className={`pointer-events-none absolute bottom-0 ${
        onRightHalf ? "right-1/2 mr-2" : "left-1/2 ml-2"
      } max-w-40 truncate whitespace-nowrap text-[11px] leading-none font-medium`}
    >
      {name}
    </span>
  );
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

/**
 * The bookmark's name. Saved when the field is left, on Enter, and when the editor closes (which
 * may remove the field without it ever losing focus).
 */
function NameInput({
  bookmark,
  onRename,
}: {
  bookmark: Bookmark;
  onRename: (label: string) => void;
}) {
  const [draft, setDraft] = useState(bookmark.label);
  const latest = useRef({ draft, bookmark, onRename });
  useEffect(() => {
    latest.current = { draft, bookmark, onRename };
  });
  const commit = useCallback(() => {
    const { draft: current, bookmark: saved, onRename: rename } = latest.current;
    const label = current.trim();
    if (label !== saved.label) {
      rename(label);
    }
  }, []);
  useEffect(() => commit, [commit]);
  return (
    <input
      type="text"
      aria-label="Bookmark name"
      value={draft}
      // The name shown while there is none: the bookmark's current time.
      placeholder={formatPosition(bookmark.positionMs)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      className={`${INPUT_CLASSES} w-full`}
    />
  );
}

/** A row's letter, A for the bookmark's position and B for its loop end. */
function RowLetter({ letter }: { letter: string }) {
  return (
    <span className={`w-3 text-sm font-semibold ${JUMP_TARGET_TEXT_CLASSES}`} aria-hidden="true">
      {letter}
    </span>
  );
}

/**
 * Edits one bookmark at its marker: rename, shift (each step plays from the new position), listen
 * from the exact mark, delete (undone from the note beside the bookmark buttons). With a loop end
 * B, also shift B (each step plays up to it) or remove it.
 */
function BookmarkEditor({
  bookmark,
  x,
  y,
  bookmarks,
  durationMs,
  onListen,
  onClose,
}: {
  bookmark: Bookmark;
  x: number;
  y: number;
  bookmarks: Bookmarks;
  durationMs: number;
  onListen: (positionMs: number) => void;
  onClose: () => void;
}) {
  const report = (action: string) => (err: unknown) => {
    console.error(err);
    window.alert(`${action} the bookmark failed.`);
  };

  const { endMs } = bookmark;
  const shift = (deltaMs: number) => {
    // The position stays before the loop end, which stays after it.
    const latestMs = endMs === null ? durationMs : endMs - MIN_LOOP_MS;
    const positionMs = Math.min(Math.max(bookmark.positionMs + deltaMs, 0), latestMs);
    bookmarks.update({ ...bookmark, positionMs }).catch(report("Shifting"));
    onListen(positionMs);
  };

  const shiftEnd = (currentEndMs: number, deltaMs: number) => {
    const earliestMs = bookmark.positionMs + MIN_LOOP_MS;
    const newEndMs = Math.min(Math.max(currentEndMs + deltaMs, earliestMs), durationMs);
    const shifted = { ...bookmark, endMs: newEndMs };
    bookmarks.update(shifted).catch(report("Shifting the loop end of"));
    onListen(loopEndListenPosition(shifted));
  };

  const removeEnd = () => {
    bookmarks.update({ ...bookmark, endMs: null }).catch(report("Removing the loop end of"));
  };

  const remove = () => {
    onClose();
    bookmarks.remove(bookmark).catch(report("Deleting"));
  };

  return (
    <FloatingMenu x={x} y={y} role="dialog" label="Edit bookmark" onClose={onClose}>
      <div className="px-2 py-1 flex flex-col gap-2 w-64">
        <NameInput
          bookmark={bookmark}
          onRename={(label) => bookmarks.update({ ...bookmark, label }).catch(report("Renaming"))}
        />
        <div className="flex items-center gap-1">
          {endMs !== null && <RowLetter letter="A" />}
          <SmallButton
            title={`${SHIFT_STEP_MS / 1000} s earlier`}
            onClick={() => shift(-SHIFT_STEP_MS)}
          >
            −
          </SmallButton>
          <span className="min-w-[6ch] text-center text-sm tabular-nums">
            {formatPrecisePosition(bookmark.positionMs)}
          </span>
          <SmallButton
            title={`${SHIFT_STEP_MS / 1000} s later`}
            onClick={() => shift(SHIFT_STEP_MS)}
          >
            +
          </SmallButton>
          <span className="flex-1" />
          <SmallButton title="Listen" onClick={() => onListen(bookmark.positionMs)}>
            ▶
          </SmallButton>
          <SmallButton title="Delete" onClick={remove}>
            🗑
          </SmallButton>
        </div>
        {endMs !== null && (
          <div className="flex items-center gap-1">
            <RowLetter letter="B" />
            <SmallButton
              title={`Loop end ${SHIFT_STEP_MS / 1000} s earlier`}
              onClick={() => shiftEnd(endMs, -SHIFT_STEP_MS)}
            >
              −
            </SmallButton>
            <span className="min-w-[6ch] text-center text-sm tabular-nums">
              {formatPrecisePosition(endMs)}
            </span>
            <SmallButton
              title={`Loop end ${SHIFT_STEP_MS / 1000} s later`}
              onClick={() => shiftEnd(endMs, SHIFT_STEP_MS)}
            >
              +
            </SmallButton>
            <span className="flex-1" />
            <SmallButton
              title="Listen to the loop end"
              onClick={() => onListen(loopEndListenPosition({ ...bookmark, endMs }))}
            >
              ▶
            </SmallButton>
            <SmallButton title="Remove the loop end" onClick={removeEnd}>
              ✕
            </SmallButton>
          </div>
        )}
      </div>
    </FloatingMenu>
  );
}

/**
 * Markers in a strip just above the position slider, out of the thumb's reach: a gray dot per
 * bookmark, and an amber marker for ↺'s target (the active bookmark, with its name, or the last
 * play start). Clicking a marker selects it; right-clicking or long-pressing a bookmark edits it.
 */
export function BookmarkMarkers({
  bookmarks,
  durationMs,
  lastPlayStartMs,
  overlay,
  onOverlayChange,
  onSelect,
  onListen,
}: {
  bookmarks: Bookmarks;
  durationMs: number;
  lastPlayStartMs: number;
  overlay: BookmarkOverlay;
  onOverlayChange: (overlay: BookmarkOverlay) => void;
  /** Makes a bookmark, or the last play start for null, ↺'s target. */
  onSelect: (bookmark: Bookmark | null) => void;
  /** Plays from a position in the song's track. */
  onListen: (positionMs: number) => void;
}) {
  const editedId = overlay?.kind === "editor" ? overlay.bookmarkId : null;
  const edited = bookmarks.bookmarks.find((bookmark) => bookmark.id === editedId) ?? null;
  // An editor whose bookmark disappeared (e.g. deleted on another device) closes.
  useEffect(() => {
    if (editedId !== null && edited === null) {
      onOverlayChange(null);
    }
  }, [editedId, edited, onOverlayChange]);

  const stripRef = useRef<HTMLDivElement>(null);

  if (durationMs <= 0) {
    return null;
  }
  const fraction = (positionMs: number) => Math.min(positionMs / durationMs, 1);
  // The thumb's center can't reach the slider's ends: it stays half a thumb (~16 px) away.
  const markerLeft = (positionMs: number) => `calc(8px + (100% - 16px) * ${fraction(positionMs)})`;
  const active = bookmarks.bookmarks.find((bookmark) => bookmark.id === bookmarks.activeId) ?? null;
  const activeEndMs = active?.endMs ?? null;
  // The editor opens below the slider, not at the pointer: shifting a bookmark should be
  // watchable on the slider. The thumb reaches 4 px below the slider's track.
  const editAt = (bookmark: Bookmark) => (x: number, pointerY: number) => {
    const slider = stripRef.current?.parentElement?.getBoundingClientRect();
    const y = slider ? slider.bottom + 8 : pointerY;
    onOverlayChange({ kind: "editor", bookmarkId: bookmark.id, x, y });
  };
  const editHint = "right-click or long-press to edit";

  return (
    <>
      {/* The strip ends a thumb's half-height above the track's center, where the thumb ends.
          It lets clicks through between the markers. */}
      <div ref={stripRef} className="pointer-events-none absolute inset-x-0 bottom-full mb-1 h-2">
        {bookmarks.bookmarks
          .filter((bookmark) => bookmark !== active)
          .map((bookmark) => (
            <MarkerButton
              key={bookmark.id}
              left={markerLeft(bookmark.positionMs)}
              title={`${bookmarkName(bookmark)} – click to select, ${editHint}`}
              label={`Select bookmark “${bookmarkName(bookmark)}”`}
              onSelect={() => onSelect(bookmark)}
              onEdit={editAt(bookmark)}
              className=""
            >
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 transition-transform group-hover:scale-150 group-hover:bg-amber-500 dark:group-hover:bg-amber-400" />
            </MarkerButton>
          ))}
        {active && activeEndMs !== null && (
          <MarkerButton
            left={markerLeft(activeEndMs)}
            title={`Loop end of ${bookmarkName(active)} – click to listen, ${editHint}`}
            label={`Listen to the loop end of “${bookmarkName(active)}”`}
            onSelect={() => onListen(loopEndListenPosition({ ...active, endMs: activeEndMs }))}
            onEdit={editAt(active)}
            className={JUMP_TARGET_TEXT_CLASSES}
          >
            <LoopEndMarker />
          </MarkerButton>
        )}
        {/* Drawn last, so that no dot covers it. */}
        {active ? (
          <MarkerButton
            left={markerLeft(active.positionMs)}
            title={`${bookmarkName(active)} – ${editHint}`}
            label={`Go to bookmark “${bookmarkName(active)}”`}
            onSelect={() => onSelect(active)}
            onEdit={editAt(active)}
            className={JUMP_TARGET_TEXT_CLASSES}
          >
            <ActiveBookmarkMarker />
            <ActiveName
              name={bookmarkName(active)}
              onRightHalf={fraction(active.positionMs) > (active.endMs === null ? 0.5 : 0.25)}
            />
          </MarkerButton>
        ) : (
          <MarkerButton
            left={markerLeft(lastPlayStartMs)}
            title={LAST_PLAY_START_LABEL}
            label={`Go to ${LAST_PLAY_START_LABEL}`}
            onSelect={() => onSelect(null)}
            onEdit={null}
            className={JUMP_TARGET_TEXT_CLASSES}
          >
            <PlayStartMarker />
          </MarkerButton>
        )}
      </div>
      {edited && overlay?.kind === "editor" && (
        <BookmarkEditor
          key={edited.id}
          bookmark={edited}
          x={overlay.x}
          y={overlay.y}
          bookmarks={bookmarks}
          durationMs={durationMs}
          onListen={onListen}
          onClose={() => onOverlayChange(null)}
        />
      )}
    </>
  );
}
