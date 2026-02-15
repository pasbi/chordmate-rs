export default interface Song {
  id: number;
  title: string;
  artist: string;
  spotifyTrack: string;
  content: string;
  albumArtUrl: string | null;
  bpm: number | null;
}

/**
 * Returns a human-readable label for a song, e.g. "Title Artist".
 * Omits missing title or artist.
 */
export function songLabel(song?: Song): string {
  if (!song) {
    return "";
  }
  return [song.title, song.artist].filter(Boolean).join(" ");
}
