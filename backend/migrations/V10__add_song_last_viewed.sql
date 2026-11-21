-- When a song's page was last opened, on any device; for sorting the song list by it.
ALTER TABLE songs
    ADD COLUMN last_viewed_at TIMESTAMPTZ NULL;
