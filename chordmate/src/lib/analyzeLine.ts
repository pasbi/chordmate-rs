/**
 * Heuristics for the chords-over-lyrics format (as on Ultimate Guitar), where chords sit on a
 * line of their own above the lyrics. Only used to convert such text into ChordPro.
 */

const CHORD_REGEX_BASE =
  /([A-G]([#b])?m?(maj|min)?(dim|aug)?(\d+)?(sus2|sus4|sus)?(\d+)?([#b]\d+)*(\+\d*)?(add\d+)?(\/[A-G]([#b])?)?\**)/;

const CHORD_REGEX = new RegExp(
  `^((${CHORD_REGEX_BASE.source})|\\((${CHORD_REGEX_BASE.source})\\))$`,
  "i"
);

/**
 * "No chord" markers, repeat markers (x2, 2x), labels (Intro:, V1:) and chord modifiers written
 * apart from their chord (C add G#).
 */
const ANNOTATION_REGEX = /^(N\.?C\.?|\(?(x\d{1,2}|\d{1,2}x)\)?|[\p{L}\d]+:|add|sus|maj|dim|aug)$/iu;

/** Chord fingerings: "x32010", "(x68766)", or "x-x-5-4-3-x", which splits into single "x" tokens. */
const FINGERING_REGEX = /^(x+|\(?[x\d]{6}\)?)$/i;

export type TokenKind = "chord" | "annotation" | "other" | "word";

export interface LineToken {
  /** Column of the token's first character. */
  start: number;
  text: string;
  kind: TokenKind;
}

export function isChord(text: string) {
  return CHORD_REGEX.test(text);
}

function tokenKind(token: string): TokenKind {
  if (CHORD_REGEX.test(token)) {
    return "chord";
  }
  if (ANNOTATION_REGEX.test(token)) {
    return "annotation";
  }
  if (FINGERING_REGEX.test(token) || !/[a-zA-Z']/.test(token)) {
    return "other";
  }
  return "word";
}

/** Splits a line into tokens, dropping whitespace and the separators "-" and "|". */
function tokenize(line: string): LineToken[] {
  const tokens: LineToken[] = [];
  for (const match of line.matchAll(/[^\s|-]+/g)) {
    tokens.push({ start: match.index, text: match[0], kind: tokenKind(match[0]) });
  }
  return tokens;
}

/**
 * Whether `line` holds only chords (plus annotations and chord diagrams), and its tokens. A line
 * with a single lyric word is no chord line.
 */
export function detectChords(line: string) {
  const tokens = tokenize(line);
  const chordCount = tokens.filter(
    (token) => token.kind === "chord" || /^N\.?C\.?$/i.test(token.text)
  ).length;
  const hasWords = tokens.some((token) => token.kind === "word");
  return { isChordLine: chordCount > 0 && !hasWords, tokens };
}

/** Section headers like "[Verse 1]" or "[Pre-Chorus]". */
export function detectSectionHeader(line: string) {
  return /^\[[a-z0-9 -/]+\]$/i.test(line);
}

/** Lines of ASCII guitar tablature, like "e|---3---|". */
export function isTabLine(line: string) {
  return /^\s*([A-Ga-g][#b]?)?\s*\|.*-{3,}.*\|/.test(line);
}
