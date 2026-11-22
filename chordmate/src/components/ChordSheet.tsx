import { type MouseEvent, type ReactNode, useMemo } from "react";
import { type Chord, parseChordPro, type Segment, type SheetLine } from "../lib/chordPro.ts";
import { useContextMenuTrigger } from "../hooks/useContextMenuTrigger";
import type { SectionAnchor } from "../hooks/useSectionAnchors";
import {
  anchorToLabel,
  headingKeys,
  type SectionKey,
  sectionKeyString,
} from "../lib/autoScroll.ts";
import { usePlaybackSecond } from "../hooks/usePlaybackSecond.ts";
import { chordGlyphs } from "../lib/chordGlyphs.ts";
import { formatTime, type Milliseconds } from "../lib/time.ts";
import { type Spelling, transposeChord } from "../lib/transpose.ts";

function ChordLabel({ chord }: { chord: Chord }) {
  return chord.isAnnotation ? (
    <span className="chord-annotation">{chord.text}</span>
  ) : (
    <span className="chord-token">{chordGlyphs(chord.text)}</span>
  );
}

/**
 * Splits lyrics into words with their trailing whitespace: the points where a line may wrap.
 * Leading whitespace stays with the first word, so that a chord above it is not followed by a gap.
 */
function splitWords(lyrics: string) {
  return lyrics.split(/(?<=\S\s+)(?=\S)/);
}

/** Lines without lyric words (intros, bar notation) are shown on a single row, chords inline. */
function isChordOnly(segments: Segment[]) {
  return !segments.some((segment) => /\p{L}{2,}/u.test(segment.lyrics));
}

function ChordOnlyLine({ segments }: { segments: Segment[] }) {
  return (
    <div className="whitespace-pre-wrap">
      {segments.map((segment, index) => (
        <span key={index}>
          {segment.chord && <ChordLabel chord={segment.chord} />}
          <span className="text-gray-500 dark:text-gray-400">{segment.lyrics}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Each chord stacks above the first word of its lyrics. A chord wider than its word widens it,
 * so chords never overlap, whatever their length. Lines wrap between words.
 */
function LyricsLine({ segments }: { segments: Segment[] }) {
  const items = segments.flatMap((segment, segmentIndex) =>
    splitWords(segment.lyrics).map((word, wordIndex) => ({
      key: `${segmentIndex}-${wordIndex}`,
      chord: wordIndex === 0 ? segment.chord : null,
      word,
    }))
  );
  return (
    <div className="flex flex-wrap items-end">
      {items.map(({ key, chord, word }) =>
        chord ? (
          <span key={key} className="inline-flex flex-col">
            <span className="pr-[0.5ch]">
              <ChordLabel chord={chord} />
            </span>
            {/* A space keeps the lyric row's height under chords without lyrics. */}
            <span className="whitespace-pre">{word === "" ? " " : word}</span>
          </span>
        ) : (
          <span key={key} className="whitespace-pre">
            {word}
          </span>
        )
      )}
    </div>
  );
}

/** What the sheet's headings can do on a song's page: anchors for auto-scroll, and jumps. */
export interface SheetSections {
  /** The anchored sections, by `sectionKeyString`. */
  anchors: Map<string, SectionAnchor>;
  /**
   * Opens a section's menu (set or remove its anchor) at a screen position; `first` tells
   * whether it is the sheet's first section, which may start right at the song's start.
   */
  onOpenMenu: (section: SectionKey, first: boolean, x: number, y: number) => void;
  /** Moves playback to a position and plays. */
  onJump: (positionMs: number) => void;
  /** Whether headings show their buttons: jump to an anchor, fine-tune it. */
  showControls: boolean;
  /** Whether unanchored headings offer to anchor them to the playback position. */
  offerAnchorNow: boolean;
  /** Lets a section start at the current playback position. */
  onStartNow: (section: SectionKey) => void;
  /** The current playback position, null while nothing is loaded. */
  readPositionMs: () => number | null;
  /** The section playing, highlighted to show how well the sheet follows; null for none. */
  current: string | null;
}

/**
 * Makes a small button react to taps a little around it too, without taking more room: the
 * sheet may move under the finger while auto-scrolling.
 */
const TOUCH_AREA = "relative after:absolute after:-inset-x-2 after:-inset-y-3 after:content-['']";

/** A small button beside a heading. */
function HeadingButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`${TOUCH_AREA} px-2.5 py-0.5 rounded-full border border-gray-300 dark:border-gray-600 text-sm font-sans tabular-nums text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 select-none focus-visible:outline-2 focus-visible:outline-blue-500`}
    >
      {children}
    </button>
  );
}

/** An anchor: the section's start is tied to the song. */
export function AnchorIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="w-3 h-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="3" r="1.75" />
      <path d="M8 4.75V14.5M5 7.5h6M2.5 10a5.5 5.5 0 0 0 11 0" />
    </svg>
  );
}

/**
 * A heading's buttons: until its section has a start, anchor it to now (a tap as the section
 * begins); then its start, which opens the menu to fine-tune, anchor anew or remove it.
 */
function HeadingControls({
  section,
  first,
  anchor,
  sections,
}: {
  section: SectionKey;
  first: boolean;
  anchor: SectionAnchor | null;
  sections: SheetSections;
}) {
  return anchor ? (
    <HeadingButton
      title="Fine-tune, anchor anew or remove where this section starts"
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        sections.onOpenMenu(section, first, bounds.left, bounds.bottom);
      }}
    >
      <span className="inline-flex items-center gap-1">
        <AnchorIcon />
        {formatTime(anchor.positionMs as Milliseconds)}
      </span>
    </HeadingButton>
  ) : (
    sections.offerAnchorNow && <AnchorToButton section={section} sections={sections} />
  );
}

/** Anchors a section to the playback position, which it shows. */
function AnchorToButton({ section, sections }: { section: SectionKey; sections: SheetSections }) {
  const positionMs = usePlaybackSecond(sections.readPositionMs);
  return (
    // Filled, unlike the other heading buttons: it is the one to hit on the beat while syncing.
    <button
      type="button"
      title="Anchor this section to the current playback position"
      onClick={() => sections.onStartNow(section)}
      className={`${TOUCH_AREA} inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-sm font-sans font-medium tabular-nums shadow-sm select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500`}
    >
      <AnchorIcon />
      {anchorToLabel(positionMs)}
    </button>
  );
}

/** Plays from a section's start; hangs left of its heading, as tall as the heading's row. */
function JumpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Jump here"
      aria-label="Jump here"
      className="absolute right-full inset-y-0 w-9 flex items-center justify-center rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-blue-500"
    >
      <svg viewBox="0 0 10 12" className="w-4 h-5" fill="currentColor" aria-hidden="true">
        <path d="M0 0l10 6-10 6z" />
      </svg>
    </button>
  );
}

/**
 * A section heading. On a song's page, a tap on an anchored one jumps to where its section
 * starts, and a right-click or long press opens its menu. Marked with its section key, so that
 * auto-scroll finds it.
 */
function Heading({
  text,
  section,
  first,
  sections,
}: {
  text: string;
  section: SectionKey | null;
  first: boolean;
  sections: SheetSections | null;
}) {
  const key = section ? sectionKeyString(section) : null;
  const anchor = key === null ? null : (sections?.anchors.get(key) ?? null);
  const menuTrigger = useContextMenuTrigger((x, y) => {
    if (section) {
      sections?.onOpenMenu(section, first, x, y);
    }
  });
  if (!sections || !section) {
    return <div className="section-header-token">{text}</div>;
  }
  return (
    <div data-section-key={key} className="relative flex flex-wrap items-center gap-x-2">
      {sections.showControls && anchor && (
        <JumpButton onClick={() => sections.onJump(anchor.positionMs)} />
      )}
      <button
        type="button"
        title={
          anchor
            ? `Starts at ${formatTime(anchor.positionMs as Milliseconds)}: tap to jump there; right-click or long-press to change`
            : "Right-click or long-press to set where this section starts"
        }
        {...menuTrigger}
        onClick={(event) => {
          // A long press that opened the menu is no tap.
          menuTrigger.onClick(event);
          if (!event.defaultPrevented && anchor) {
            sections.onJump(anchor.positionMs);
          }
        }}
        // select-none and no touch callout: a long press opens the menu, not the browser's.
        className="section-header-token text-left select-none [-webkit-touch-callout:none] rounded focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        {text}
      </button>
      {sections.showControls ? (
        <HeadingControls section={section} first={first} anchor={anchor} sections={sections} />
      ) : (
        anchor && (
          <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400 select-none">
            {formatTime(anchor.positionMs as Milliseconds)}
          </span>
        )
      )}
    </div>
  );
}

function SheetLineView({
  line,
  section,
  first,
  sections,
}: {
  line: SheetLine;
  section: SectionKey | null;
  /** Whether the line is the sheet's first heading. */
  first: boolean;
  sections: SheetSections | null;
}) {
  switch (line.kind) {
    case "empty":
      return <div>{" "}</div>;
    case "heading":
      return <Heading text={line.text} section={section} first={first} sections={sections} />;
    case "tab":
      return <pre className="font-mono">{line.lines.join("\n")}</pre>;
    case "lyrics":
      if (line.segments.every((segment) => segment.chord === null)) {
        return <div className="whitespace-pre-wrap">{line.segments[0]?.lyrics}</div>;
      }
      return isChordOnly(line.segments) ? (
        <ChordOnlyLine segments={line.segments} />
      ) : (
        <LyricsLine segments={line.segments} />
      );
  }
}

function transposeLine(line: SheetLine, semitones: number, spelling: Spelling): SheetLine {
  if (line.kind !== "lyrics") {
    return line;
  }
  const transposeSegment = (segment: Segment): Segment =>
    segment.chord === null || segment.chord.isAnnotation
      ? segment
      : {
          ...segment,
          chord: {
            ...segment.chord,
            text: transposeChord(segment.chord.text, semitones, spelling),
          },
        };
  return { ...line, segments: line.segments.map(transposeSegment) };
}

/**
 * The sheet split into sections, each from a heading to the next; lines before the first
 * heading form a block without a key.
 */
function blocks(lines: SheetLine[], keys: Map<number, SectionKey>) {
  const result: { start: number; key: string | null; lines: SheetLine[] }[] = [];
  lines.forEach((line, index) => {
    const section = keys.get(index);
    if (section || result.length === 0) {
      result.push({ start: index, key: section ? sectionKeyString(section) : null, lines: [] });
    }
    result[result.length - 1].lines.push(line);
  });
  return result;
}

/**
 * Renders a song's ChordPro source for reading and playing, with its chords shifted by
 * `transpose` semitones.
 */
export default function ChordSheet({
  source,
  transpose,
  spelling,
  sections,
}: {
  source: string;
  transpose: number;
  spelling: Spelling;
  /** Null where headings are just text (e.g. an import's preview). */
  sections: SheetSections | null;
}) {
  const lines = useMemo(
    () => parseChordPro(source).map((line) => transposeLine(line, transpose, spelling)),
    [source, transpose, spelling]
  );
  const keys = useMemo(() => headingKeys(lines), [lines]);
  const sectionBlocks = useMemo(() => blocks(lines, keys), [lines, keys]);
  const firstHeadingIndex = keys.keys().next().value ?? null;
  const current = sections?.current ?? null;
  return (
    // Room on the left for the headings' jump buttons.
    <div className={sections?.showControls ? "pl-9" : ""}>
      {sectionBlocks.map(({ start, key, lines: blockLines }) => (
        <div
          key={start}
          className={`-mx-1 px-1 rounded transition-colors duration-300 ${
            key !== null && key === current ? "bg-amber-100 dark:bg-amber-900/30" : ""
          }`}
        >
          {blockLines.map((line, offset) => (
            <SheetLineView
              key={start + offset}
              line={line}
              section={keys.get(start + offset) ?? null}
              first={start + offset === firstHeadingIndex}
              sections={sections}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
