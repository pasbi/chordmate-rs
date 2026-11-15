/**
 * Parsing of ChordPro (https://www.chordpro.org), the format songs are stored in: chords sit in
 * brackets right before the syllable they belong to, `[Am]Lyrics go [F]here`.
 *
 * Supported: chords and annotations (`[*x2]`), comments (`{c: Verse 1}`) and section labels
 * (`{start_of_chorus: Chorus}`) as headings, tab blocks (`{start_of_tab}` … `{end_of_tab}`).
 * Other directives (title, key, …) are ignored. As an extension, a line that is just a bracketed
 * non-chord (`[Verse 1]`) is a heading too, as on Ultimate Guitar.
 */
import { isChord } from "./analyzeLine.ts";

export interface Chord {
  text: string;
  /** Annotations (`[*x2]`) are shown like chords but are not chords. */
  isAnnotation: boolean;
}

/** A chord and the lyrics up to the next chord. */
export interface Segment {
  chord: Chord | null;
  lyrics: string;
}

export type SheetLine =
  | { kind: "lyrics"; segments: Segment[] }
  | { kind: "heading"; text: string }
  | { kind: "tab"; lines: string[] }
  | { kind: "empty" };

/** A bracketed chord in a source line, brackets included. */
export interface ChordMark {
  start: number;
  end: number;
  chord: Chord;
}

export type SourceLine =
  | { kind: "directive"; name: string; value: string }
  | { kind: "heading"; text: string }
  | { kind: "lyrics"; marks: ChordMark[] };

const DIRECTIVE_REGEX = /^\s*\{\s*([\w-]+)\s*(?:[:\s]\s*(.*?))?\s*\}\s*$/;
const LONE_BRACKET_REGEX = /^\s*\[([^\]\n]+)\]\s*$/;
const CHORD_MARK_REGEX = /\[([^\]\n]*)\]/g;

const COMMENT_DIRECTIVES = new Set([
  "c",
  "comment",
  "ci",
  "comment_italic",
  "cb",
  "comment_box",
  "highlight",
]);

const SECTION_ABBREVIATIONS = new Map([
  ["c", "chorus"],
  ["v", "verse"],
  ["b", "bridge"],
  ["t", "tab"],
  ["g", "grid"],
]);

function parseChord(text: string): Chord {
  return text.startsWith("*")
    ? { text: text.slice(1), isAnnotation: true }
    : { text, isAnnotation: false };
}

/** Classifies a line of ChordPro source; shared by the sheet view and the editor's highlighting. */
export function analyzeSourceLine(line: string): SourceLine {
  const directive = DIRECTIVE_REGEX.exec(line);
  if (directive) {
    return { kind: "directive", name: directive[1].toLowerCase(), value: directive[2] ?? "" };
  }
  const loneBracket = LONE_BRACKET_REGEX.exec(line);
  if (loneBracket && !loneBracket[1].startsWith("*") && !isChord(loneBracket[1].trim())) {
    return { kind: "heading", text: loneBracket[1].trim() };
  }
  const marks = [...line.matchAll(CHORD_MARK_REGEX)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    chord: parseChord(match[1]),
  }));
  return { kind: "lyrics", marks };
}

/** Whether `text` uses ChordPro markup: directives or bracketed chords. */
export function isChordPro(text: string) {
  return text.split("\n").some((line) => {
    const analysis = analyzeSourceLine(line);
    return (
      analysis.kind === "directive" ||
      (analysis.kind === "lyrics" &&
        analysis.marks.some((mark) => mark.chord.isAnnotation || isChord(mark.chord.text)))
    );
  });
}

function splitSegments(line: string, marks: ChordMark[]): Segment[] {
  const segments: Segment[] = [];
  if (marks.length === 0 || marks[0].start > 0) {
    segments.push({ chord: null, lyrics: line.slice(0, marks[0]?.start ?? line.length) });
  }
  marks.forEach((mark, index) => {
    const end = marks[index + 1]?.start ?? line.length;
    segments.push({ chord: mark.chord, lyrics: line.slice(mark.end, end) });
  });
  return segments;
}

interface SectionDirective {
  section: string;
  isStart: boolean;
}

/** "start_of_chorus" → chorus start, "eov" → verse end, "title" → null. */
function sectionDirective(name: string): SectionDirective | null {
  const full = /^(start|end)_of_(\w+)$/.exec(name);
  if (full) {
    return { section: full[2], isStart: full[1] === "start" };
  }
  const abbreviated = /^(s|e)o([a-z])$/.exec(name);
  const section = abbreviated ? SECTION_ABBREVIATIONS.get(abbreviated[2]) : undefined;
  return abbreviated && section ? { section, isStart: abbreviated[1] === "s" } : null;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** What a directive line shows, or null for directives that show nothing. */
function directiveLine(name: string, value: string): SheetLine | null {
  if (COMMENT_DIRECTIVES.has(name)) {
    return value === "" ? null : { kind: "heading", text: value };
  }
  const section = sectionDirective(name);
  if (section === null || !section.isStart) {
    return null;
  }
  if (value !== "") {
    return { kind: "heading", text: value };
  }
  // Tabs explain themselves; other sections are labeled with their name.
  return section.section === "tab" ? null : { kind: "heading", text: capitalize(section.section) };
}

export function parseChordPro(source: string): SheetLine[] {
  const result: SheetLine[] = [];
  let tab: string[] | null = null;
  for (const line of source.split("\n")) {
    const analysis = analyzeSourceLine(line);
    const section = analysis.kind === "directive" ? sectionDirective(analysis.name) : null;
    if (tab !== null) {
      if (section?.section === "tab" && !section.isStart) {
        result.push({ kind: "tab", lines: tab });
        tab = null;
      } else {
        tab.push(line);
      }
      continue;
    }
    if (analysis.kind === "directive") {
      const shown = directiveLine(analysis.name, analysis.value);
      if (shown !== null) {
        result.push(shown);
      }
      if (section?.section === "tab" && section.isStart) {
        tab = [];
      }
    } else if (analysis.kind === "heading") {
      result.push(analysis);
    } else if (line.trim() === "") {
      result.push({ kind: "empty" });
    } else {
      result.push({ kind: "lyrics", segments: splitSegments(line, analysis.marks) });
    }
  }
  if (tab !== null) {
    result.push({ kind: "tab", lines: tab });
  }
  return result;
}

interface TidyLine {
  text: string;
  isBlank: boolean;
  isHeading: boolean;
}

/** Classifies lines for tidying; lines in tab blocks are kept as they are. */
function tidyLines(source: string): TidyLine[] {
  const lines: TidyLine[] = [];
  let inTab = false;
  for (const line of source.split("\n")) {
    const analysis = analyzeSourceLine(line);
    const section = analysis.kind === "directive" ? sectionDirective(analysis.name) : null;
    const isTabBoundary = section?.section === "tab" && section.isStart !== inTab;
    if (inTab && !isTabBoundary) {
      lines.push({ text: line.trimEnd(), isBlank: false, isHeading: false });
      continue;
    }
    if (isTabBoundary) {
      inTab = !inTab;
    }
    // A line without chords may still be unconverted chords above lyrics, whose spaces align them.
    const hasChords = analysis.kind !== "lyrics" || analysis.marks.length > 0;
    const text = hasChords ? line.replace(/\s+/g, " ").trim() : line.trimEnd();
    const isHeading =
      analysis.kind === "heading" ||
      (analysis.kind === "directive" && directiveLine(analysis.name, analysis.value) !== null);
    lines.push({ text, isBlank: text === "", isHeading });
  }
  return lines;
}

/**
 * Removes whitespace without meaning in ChordPro, as left over from aligning chords above lyrics:
 * in lines with chords and in directives, runs of spaces become one and the line is trimmed; other
 * lines only lose trailing whitespace, so that chords the conversion missed stay aligned with
 * their lyrics. Blank lines are dropped at the start and end, right after headings and when
 * repeated. Tab blocks keep their alignment.
 */
export function tidyChordPro(source: string) {
  const kept = tidyLines(source).reduce<TidyLine[]>((result, line) => {
    const previous = result.at(-1);
    const dropBlank = previous === undefined || previous.isBlank || previous.isHeading;
    return line.isBlank && dropBlank ? result : [...result, line];
  }, []);
  if (kept.at(-1)?.isBlank) {
    kept.pop();
  }
  return kept.map((line) => line.text).join("\n");
}
