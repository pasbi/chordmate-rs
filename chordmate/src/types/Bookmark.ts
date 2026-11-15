/** A position in a song's Spotify track to jump back to while practicing. */
export default interface Bookmark {
  id: number;
  positionMs: number;
  label: string;
}
