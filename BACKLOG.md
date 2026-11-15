# Backlog

Planned features and ideas, roughly in the order they are meant to be done.

## Playback bookmarks

Repeating a passage while practicing means seeking back to its start again and again.
Bookmarks make that a single press.

### Storage

- Table `bookmarks`: `id`, `song_id` → `songs` (on delete cascade), `spotify_track`,
  `position_ms`, `label`.
- Bookmarks belong to a song *and* its Spotify track. The song page shows only the bookmarks
  of the currently linked track: linking another track hides them, restoring the old track
  brings them back. Nothing is deleted when the track changes.
- Saved immediately, independent of the sheet's unsaved changes.
- The active bookmark is a per-browser convenience, stored in `localStorage` per song and
  track. A newly added bookmark becomes active right away.

### Player

```
[⇤] [−10] [−1] [▶] [+1] [+10]   [🔖+] [↺|▾]
0:47 ━━━━━━━╎━━━━━━┃━━━━━━━━━━━╎━━━━ 3:41
```

- **🔖+** adds a bookmark at the current position; its default label is the time.
- **↺|▾** is a split button (like Qt's `QToolButton` with a menu):
  - **↺** jumps to the active bookmark minus a 2 s pre-roll and plays. Icon only; the
    bookmark's name is in the tooltip, so the button never changes width.
  - **▾** opens a menu listing all bookmarks (sorted by time, with times, the active one
    marked) plus a last entry “Manage bookmarks…”. Picking a bookmark only makes it active;
    it does not jump.
  - The ▾ part must stay comfortably tappable on a tablet (≥ 28–32 px wide).
- Faint ticks on the position slider for all bookmarks, a slightly stronger one for the
  active bookmark.
- Shortcuts: `B` adds a bookmark, `R` jumps. While the menu or the manager is open, the
  player shortcuts are disabled so that arrow keys navigate instead of seeking.

### Last play start

A fixed first entry “▶ Last play start”: where Play (button or Space) was last pressed. It
can be made active like any bookmark, but not renamed, shifted or deleted. Jumping to it
uses no pre-roll, and the jump itself does not update it. It is the default when a track
has no bookmarks yet, so ↺ is useful from the start.

### Manager

A modal dialog opened from “Manage bookmarks…”, one row per bookmark:

- select as active,
- rename,
- shift with −/+ steps (0.1 s or 0.25 s, to be tried); each step plays from the new
  position,
- listen: plays from the exact mark, without pre-roll,
- delete, with an undo toast instead of a confirmation dialog.

### Later

- Configurable pre-roll (off / 2 s / one bar from the BPM), possibly with a metronome
  count-in.
- A–B loop between two bookmarks, with a repeat count.
- Foot pedal support (page-turner pedals often send arrow keys or PageUp/PageDown, which
  collide with the seek shortcuts).

## Section timestamps from LRCLIB

Spotify provides no labeled sections: Audio Analysis only had unlabeled sections and is
deprecated since November 2024, and synced lyrics are not in the public Web API.

[LRCLIB](https://lrclib.net) is a free, open database of synced lyrics (LRC) with a simple
API that looks up a track by artist, title and duration, all of which are known from
Spotify. Fuzzy-matching the sheet's lyric lines to the timed LRC lines would give each
`[Verse]` / `[Chorus]` header the time of its first lyric line.

- Only a suggestion the user confirms or adjusts; manual tap-to-sync stays the fallback.
- Instrumental parts (intro, solo, outro) have no lyrics and need manual input.
- Repeated choruses must be matched in order; abbreviated sheets (“Chorus 2×”) match poorly.
- Opt-in, since it sends artist and title to a third party.
- Builds on bookmarks: section times could become bookmarks, and allow highlighting or
  auto-scrolling the current section.
