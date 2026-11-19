import { describe, expect, it, vi } from "vitest";
import { bookmarkletUrl, type ImportedSong, parseImportFragment } from "./songImport.ts";

const SONG: ImportedSong = {
  title: "Take On Me",
  artist: "a-ha",
  content: "[Verse 1]\r\n[tab][ch]Am[/ch]         [ch]D/F#[/ch]\r\nTalking away[/tab]",
  capo: 2,
  sourceUrl: "https://tabs.ultimate-guitar.com/tab/a-ha/take-on-me-chords-1842621",
};

/** Runs the bookmarklet's code with a fake page; returns the URL it went to, if any. */
function runBookmarklet(page: { UGAPP?: unknown; jsStore?: string }) {
  const code = decodeURIComponent(
    bookmarkletUrl("http://shadowfax:8080").slice("javascript:".length)
  );
  const alert = vi.fn();
  const window = { UGAPP: page.UGAPP };
  const document = {
    querySelector: () => (page.jsStore === undefined ? null : { getAttribute: () => page.jsStore }),
  };
  const location = { href: SONG.sourceUrl };
  new Function("window", "document", "location", "alert", code)(window, document, location, alert);
  return {
    opened: location.href === SONG.sourceUrl ? undefined : location.href,
    alerted: alert.mock.calls.length > 0,
  };
}

const PAGE_DATA = {
  tab: { song_name: SONG.title, artist_name: SONG.artist },
  tab_view: { wiki_tab: { content: SONG.content }, meta: { capo: 2 } },
};

describe("bookmarklet", () => {
  it("sends the song from window.UGAPP to the import page", () => {
    const { opened } = runBookmarklet({ UGAPP: { store: { page: { data: PAGE_DATA } } } });
    expect(opened?.startsWith("http://shadowfax:8080/import#")).toBe(true);
    expect(parseImportFragment(new URL(opened ?? "").hash)).toEqual(SONG);
  });

  it("falls back to the page's .js-store data", () => {
    const jsStore = JSON.stringify({ store: { page: { data: PAGE_DATA } } });
    const { opened } = runBookmarklet({ jsStore });
    expect(parseImportFragment(new URL(opened ?? "").hash)).toEqual(SONG);
  });

  it("takes a missing capo as none", () => {
    const data = { ...PAGE_DATA, tab_view: { wiki_tab: { content: SONG.content } } };
    const { opened } = runBookmarklet({ UGAPP: { store: { page: { data } } } });
    expect(parseImportFragment(new URL(opened ?? "").hash)?.capo).toBe(0);
  });

  it("explains instead of opening on a page without chords", () => {
    expect(runBookmarklet({})).toEqual({ opened: undefined, alerted: true });
  });
});

describe("parseImportFragment", () => {
  it("reads nothing from an empty fragment", () => {
    expect(parseImportFragment("")).toBeNull();
    expect(parseImportFragment("#")).toBeNull();
  });

  it("rejects broken or incomplete data", () => {
    expect(parseImportFragment("#%7Bnot%20json")).toBeNull();
    expect(
      parseImportFragment(`#${encodeURIComponent(JSON.stringify({ title: "x" }))}`)
    ).toBeNull();
  });
});
