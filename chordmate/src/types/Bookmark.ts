/**
 * A position in a song's Spotify track to jump back to while practicing. With an end point B, the
 * passage from the position up to it is played again and again.
 */
export default interface Bookmark {
  id: number;
  positionMs: number;
  label: string;
  /** B, always after the position; null without one. */
  endMs: number | null;
}
