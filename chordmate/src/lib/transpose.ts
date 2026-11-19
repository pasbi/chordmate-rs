/**
 * Transposing chord names by semitones, e.g. to make a sheet match a recording. Only the note
 * names change (the root, and the bass after a slash); the rest of a chord is kept. Transposed
 * notes are written with sharps.
 */

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NATURAL_PITCH_CLASSES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** A chord's root at its start (after an optional parenthesis), or a bass note after a slash. */
const NOTE_REGEX = /(^\(?|\/)([A-G])([#b]?)/g;

function transposeNote(letter: string, accidental: string, semitones: number) {
  const shift = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  const pitch = NATURAL_PITCH_CLASSES[letter] + shift + semitones;
  return NOTE_NAMES[((pitch % 12) + 12) % 12];
}

/** Shifts a chord's root and bass note; text that doesn't start with a note stays as it is. */
export function transposeChord(chord: string, semitones: number) {
  if (semitones === 0) {
    return chord;
  }
  return chord.replace(
    NOTE_REGEX,
    (_match, before: string, letter: string, accidental: string) =>
      before + transposeNote(letter, accidental, semitones)
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
