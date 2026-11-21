-- When a sheet's section starts in the song's Spotify track, for scrolling the sheet along. A
-- section is its heading's text and which occurrence of that text it is ("Chorus", the 2nd),
-- so that adding or removing other sections keeps the anchors where they belong.
CREATE TABLE section_anchors
(
    id            SERIAL PRIMARY KEY,
    song_id       INTEGER NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
    spotify_track TEXT    NOT NULL,
    heading       TEXT    NOT NULL,
    occurrence    INTEGER NOT NULL CHECK (occurrence >= 1),
    position_ms   INTEGER NOT NULL CHECK (position_ms >= 0),
    UNIQUE (song_id, spotify_track, heading, occurrence)
);
