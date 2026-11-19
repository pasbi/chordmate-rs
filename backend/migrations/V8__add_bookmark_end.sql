-- An optional end point B: playing from a bookmark with one repeats the passage up to it.
ALTER TABLE bookmarks
    ADD COLUMN end_ms INTEGER CHECK (end_ms > position_ms);
