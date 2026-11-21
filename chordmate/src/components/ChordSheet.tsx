import { useMemo } from "react";
import { type Chord, parseChordPro, type Segment, type SheetLine } from "../lib/chordPro.ts";
import { useContextMenuTrigger } from "../hooks/useContextMenuTrigger";
import type { SectionAnchor } from "../hooks/useSectionAnchors";
import { headingKeys, type SectionKey, sectionKeyString } from "../lib/autoScroll.ts";
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
  /** Opens a section's menu (set or remove its anchor) at a screen position. */
  onOpenMenu: (section: SectionKey, x: number, y: number) => void;
  /** Moves playback to a position and plays. */
  onJump: (positionMs: number) => void;
  /** The section playing, highlighted to show how well the sheet follows; null for none. */
  current: string | null;
}

/**
 * A section heading. On a song's page, a tap on an anchored one jumps to where its section
 * starts, and a right-click or long press opens its menu. Marked with its section key, so that
 * auto-scroll finds it.
 */
function Heading({
  text,
  section,
  sections,
}: {
  text: string;
  section: SectionKey | null;
  sections: SheetSections | null;
}) {
  const key = section ? sectionKeyString(section) : null;
  const anchor = key === null ? null : (sections?.anchors.get(key) ?? null);
  const menuTrigger = useContextMenuTrigger((x, y) => {
    if (section) {
      sections?.onOpenMenu(section, x, y);
    }
  });
  if (!sections || !section) {
    return <div className="section-header-token">{text}</div>;
  }
  return (
    <div data-section-key={key} className="flex items-baseline gap-2">
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
      {anchor && (
        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400 select-none">
          {formatTime(anchor.positionMs as Milliseconds)}
        </span>
      )}
    </div>
  );
}

function SheetLineView({
  line,
  section,
  sections,
}: {
  line: SheetLine;
  section: SectionKey | null;
  sections: SheetSections | null;
}) {
  switch (line.kind) {
    case "empty":
      return <div>{" "}</div>;
    case "heading":
      return <Heading text={line.text} section={section} sections={sections} />;
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
  const current = sections?.current ?? null;
  return (
    <div>
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
              sections={sections}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
