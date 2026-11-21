-- How the song's chords write black-key notes, also untransposed: common (C#, Eb, F#, Ab, Bb),
-- sharps only, or flats only.
ALTER TABLE songs
    ADD COLUMN spelling TEXT NOT NULL DEFAULT 'common' CHECK (spelling IN ('common', 'sharps', 'flats'));
