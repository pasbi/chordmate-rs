/**
 * Importing a song from an Ultimate Guitar tab page. A bookmarklet reads the song from the page
 * the user has open and replaces it with ChordMate's import page, with the song in the URL's
 * fragment. The fragment never leaves the browser, and going from an https:// page to an
 * http:// one is allowed, where a request to it would be blocked as mixed content.
 */

/** A song as the bookmarklet sends it. */
export interface ImportedSong {
  title: string;
  artist: string;
  /** The sheet in Ultimate Guitar's format: chords over lyrics, with `[ch]`/`[tab]` markup. */
  content: string;
  /** The capo fret the chords are written for; 0 without a capo. */
  capo: number;
  /** The page the song was imported from. */
  sourceUrl: string;
}

/** The path of ChordMate's import page. */
export const IMPORT_PATH = "/import";

function isImportedSong(value: unknown): value is ImportedSong {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const song = value as Record<string, unknown>;
  return (
    typeof song.title === "string" &&
    typeof song.artist === "string" &&
    typeof song.content === "string" &&
    typeof song.capo === "number" &&
    Number.isInteger(song.capo) &&
    typeof song.sourceUrl === "string"
  );
}

/** Reads the song from the import page's fragment (`#…`); null if there is none or it's broken. */
export function parseImportFragment(fragment: string): ImportedSong | null {
  const encoded = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  if (encoded === "") {
    return null;
  }
  try {
    const value: unknown = JSON.parse(decodeURIComponent(encoded));
    return isImportedSong(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * The code the bookmarklet runs on an Ultimate Guitar tab page. The page keeps its data in
 * `window.UGAPP.store.page.data` (earlier as JSON in `.js-store`'s `data-content`). Kept in
 * plain ES5-style JavaScript, since it runs as is in the page.
 */
function bookmarkletBody(importUrl: string) {
  return `(function () {
  var data = null;
  try {
    data = window.UGAPP.store.page.data;
  } catch (e) {}
  if (!data || !data.tab_view) {
    try {
      data = JSON.parse(document.querySelector(".js-store").getAttribute("data-content")).store.page.data;
    } catch (e) {}
  }
  var content = data && data.tab_view && data.tab_view.wiki_tab && data.tab_view.wiki_tab.content;
  if (!content) {
    alert("ChordMate: no Ultimate Guitar chords found on this page. Open a chords page of a song.");
    return;
  }
  var meta = data.tab_view.meta || {};
  var song = {
    title: data.tab.song_name || "",
    artist: data.tab.artist_name || "",
    content: content,
    capo: parseInt(meta.capo, 10) || 0,
    sourceUrl: location.href
  };
  location.href = ${JSON.stringify(importUrl)} + "#" + encodeURIComponent(JSON.stringify(song));
})();`;
}

/** The bookmarklet's address (`javascript:…`), sending songs to ChordMate at `origin`. */
export function bookmarkletUrl(origin: string) {
  return `javascript:${encodeURIComponent(bookmarkletBody(origin + IMPORT_PATH))}`;
}
