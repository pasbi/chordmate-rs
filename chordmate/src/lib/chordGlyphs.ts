/**
 * Chords as shown: with the music signs ♯ and ♭ instead of # and b. The source keeps # and b,
 * which are easy to type. A "b" is a flat only right after a note letter (Bb, Ebm, D/Ab) or
 * before an alteration's number (7b9, m7b5); any other "b" stays a letter.
 */

const FLAT_AFTER_NOTE_REGEX = /([A-G])b/g;
const FLAT_ALTERATION_REGEX = /(^|[^A-Za-z])b(?=\d)/g;

export function chordGlyphs(chord: string) {
  return chord
    .replaceAll("#", "♯")
    .replace(FLAT_AFTER_NOTE_REGEX, "$1♭")
    .replace(FLAT_ALTERATION_REGEX, "$1♭");
}
