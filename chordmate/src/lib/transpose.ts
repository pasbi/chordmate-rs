/**
 * Transposing chord names by semitones, e.g. to make a sheet match a recording. Only the note
 * names change (the root, and the bass after a slash); the rest of a chord is kept.
 *
 * How black-key notes are spelled is the song's choice, not guessed from a key: many songs
 * change keys, and sheets from Ultimate Guitar use sharps throughout. It applies to every chord,
 * also untransposed: the common names (C#, Eb, F#, Ab, Bb), sharps only, or flats only.
 */

export type Spelling = "common" | "sharps" | "flats";

const NOTE_NAMES: Record<Spelling, string[]> = {
  common: ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"],
  sharps: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"],
  flats: ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"],
};
const NATURAL_PITCH_CLASSES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** A chord's root at its start (after an optional parenthesis), or a bass note after a slash. */
const NOTE_REGEX = /(^\(?|\/)([A-G])([#b]?)/g;

function transposeNote(letter: string, accidental: string, semitones: number, spelling: Spelling) {
  const shift = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  const pitch = NATURAL_PITCH_CLASSES[letter] + shift + semitones;
  return NOTE_NAMES[spelling][((pitch % 12) + 12) % 12];
}

/**
 * Shifts a chord's root and bass note, and spells them; text that doesn't start with a note stays
 * as it is.
 */
export function transposeChord(chord: string, semitones: number, spelling: Spelling) {
  return chord.replace(
    NOTE_REGEX,
    (_match, before: string, letter: string, accidental: string) =>
      before + transposeNote(letter, accidental, semitones, spelling)
  );
}

/**
 * Transpositions repeat every octave (+12 is ±0), so they wrap around within one: from −5 to +6,
 * the shortest way to each key.
 */
const LOWEST_TRANSPOSE = -5;
const SEMITONES_PER_OCTAVE = 12;

export function wrapTranspose(transpose: number) {
  const offset = transpose - LOWEST_TRANSPOSE;
  return (
    (((offset % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE) +
    LOWEST_TRANSPOSE
  );
}
