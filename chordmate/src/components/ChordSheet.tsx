import { useMemo } from "react";
import { type Chord, parseChordPro, type Segment, type SheetLine } from "../lib/chordPro.ts";
import { chordGlyphs } from "../lib/chordGlyphs.ts";
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

function SheetLineView({ line }: { line: SheetLine }) {
  switch (line.kind) {
    case "empty":
      return <div>{" "}</div>;
    case "heading":
      return <div className="section-header-token">{line.text}</div>;
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
 * Renders a song's ChordPro source for reading and playing, with its chords shifted by
 * `transpose` semitones.
 */
export default function ChordSheet({
  source,
  transpose,
  spelling,
}: {
  source: string;
  transpose: number;
  spelling: Spelling;
}) {
  const lines = useMemo(
    () => parseChordPro(source).map((line) => transposeLine(line, transpose, spelling)),
    [source, transpose, spelling]
  );
  return (
    <div>
      {lines.map((line, index) => (
        <SheetLineView key={index} line={line} />
      ))}
    </div>
  );
}
