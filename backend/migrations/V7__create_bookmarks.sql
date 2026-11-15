-- Positions in a song's Spotify track to jump back to while practicing. They belong to the song
-- and the track: linking another track hides them, linking the old one again brings them back.
CREATE TABLE bookmarks
(
    id            SERIAL PRIMARY KEY,
    song_id       INTEGER NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
    spotify_track TEXT    NOT NULL,
    position_ms   INTEGER NOT NULL CHECK (position_ms >= 0),
    label         TEXT    NOT NULL
);

CREATE INDEX bookmarks_song_track ON bookmarks (song_id, spotify_track);
