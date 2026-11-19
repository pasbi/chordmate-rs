-- Semitones the song's chords are shifted by when shown, e.g. to match the recording. The stored
-- sheet stays as written.
ALTER TABLE songs
    ADD COLUMN transpose INTEGER NOT NULL DEFAULT 0 CHECK (transpose BETWEEN -11 AND 11);
