/**
 * Conversion of the chords-over-lyrics format (as copied from Ultimate Guitar and similar sites)
 * into ChordPro. This is the only place the chord line heuristic is used: its result is visible
 * in the converted text, where it can be corrected.
 */
import { detectChords, detectSectionHeader, isTabLine, type LineToken } from "./analyzeLine.ts";
import { isChordPro, tidyChordPro } from "./chordPro.ts";

/** Ultimate Guitar's raw markup: chords in `[ch]…[/ch]`, chord/lyric pairs in `[tab]…[/tab]`. */
const ULTIMATE_GUITAR_MARKUP_REGEX = /\[\/?(ch|tab)\]/i;

/** Removes Ultimate Guitar's markup. Columns are counted without it, so alignment is kept. */
function stripUltimateGuitarMarkup(text: string) {
  return text.replace(new RegExp(ULTIMATE_GUITAR_MARKUP_REGEX, "gi"), "");
}

function chordMark(token: LineToken) {
  return token.kind === "chord" ? `[${token.text}]` : `[*${token.text}]`;
}

/** Inserts the chords of a chord line into the lyric line below it, at their columns. */
function mergeChordsIntoLyrics(chordTokens: LineToken[], lyrics: string) {
  // Bar lines and fingerings have no place in the lyrics.
  const marked = chordTokens.filter(
    (token) => token.kind === "chord" || token.kind === "annotation"
  );
  // Right to left, so that inserting a chord does not shift the columns of the ones before it.
  return [...marked].reverse().reduce((line, token) => {
    const padded = line.padEnd(token.start);
    return padded.slice(0, token.start) + chordMark(token) + padded.slice(token.start);
  }, lyrics);
}

/** A chord line without lyrics: chords and annotations are marked, everything else is kept. */
function markChordLine(line: string, tokens: LineToken[]) {
  return [...tokens].reverse().reduce((result, token) => {
    if (token.kind === "other") {
      return result;
    }
    const end = token.start + token.text.length;
    return result.slice(0, token.start) + chordMark(token) + result.slice(end);
  }, line);
}

function isLyricLine(line: string | undefined) {
  return (
    line !== undefined &&
    line.trim() !== "" &&
    !detectChords(line).isChordLine &&
    !detectSectionHeader(line.trim()) &&
    !isTabLine(line)
  );
}

/** The number of tab lines starting at `start`. */
function tabLineCount(lines: string[], start: number) {
  const end = lines.findIndex((line, index) => index >= start && !isTabLine(line));
  return (end === -1 ? lines.length : end) - start;
}

/**
 * Converts chords-over-lyrics text into tidy ChordPro. ChordPro markup in the text is kept, but
 * its whitespace is tidied too.
 */
export function ultimateGuitarToChordPro(text: string) {
  const lines = stripUltimateGuitarMarkup(text)
    .split("\n")
    .map((line) => line.trimEnd());
  const output: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const chords = detectChords(line);
    // A chord line right above tablature belongs to it: in a tab block, it keeps its alignment.
    const tabStart = chords.isChordLine && isTabLine(lines[index + 1] ?? "") ? index + 1 : index;
    const tabCount = tabLineCount(lines, tabStart);
    if (tabCount > 0) {
      output.push("{start_of_tab}", ...lines.slice(index, tabStart + tabCount), "{end_of_tab}");
      index = tabStart + tabCount;
    } else if (detectSectionHeader(line.trim())) {
      output.push(`{c: ${line.trim().slice(1, -1).trim()}}`);
      index += 1;
    } else if (chords.isChordLine && isLyricLine(lines[index + 1])) {
      output.push(mergeChordsIntoLyrics(chords.tokens, lines[index + 1]));
      index += 2;
    } else if (chords.isChordLine) {
      output.push(markChordLine(line, chords.tokens));
      index += 1;
    } else {
      output.push(line);
      index += 1;
    }
  }
  // Only now: before conversion, whitespace aligns the chords.
  return tidyChordPro(output.join("\n"));
}

/** Whether `text` is in the chords-over-lyrics format and needs converting. */
export function looksLikeChordsOverLyrics(text: string) {
  if (ULTIMATE_GUITAR_MARKUP_REGEX.test(text)) {
    return true;
  }
  return !isChordPro(text) && text.split("\n").some((line) => detectChords(line).isChordLine);
}

/**
 * Whether pasted text is converted. Single lines stay as they are: a pasted "A" is more likely a
 * word than a chord.
 */
export function shouldConvertPaste(text: string) {
  return text.trim().includes("\n") && looksLikeChordsOverLyrics(text);
}

const HTML_ENTITIES = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
  ["#39", "'"],
  ["nbsp", " "],
]);

/** Songs used to be saved as the editor's HTML (`<pre><code>…</code></pre>`, `<p>…</p>`). */
function htmlToPlainText(html: string) {
  return html
    .replace(/<br\s*\/?>|<\/(p|pre)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(\w+|#39);/g, (entity, name: string) => HTML_ENTITIES.get(name) ?? entity)
    .trimEnd();
}

/** Brings stored song content of any earlier format into ChordPro. */
export function normalizeSongContent(content: string) {
  const text = /^\s*<(p|pre)[\s>]/i.test(content) ? htmlToPlainText(content) : content;
  return looksLikeChordsOverLyrics(text) ? ultimateGuitarToChordPro(text) : text;
}
