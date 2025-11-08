DROP TABLE IF EXISTS users;
CREATE TABLE songs
(
    id            SERIAL PRIMARY KEY,
    title         TEXT,
    artist        TEXT,
    content       TEXT,
    spotify_track TEXT
);
