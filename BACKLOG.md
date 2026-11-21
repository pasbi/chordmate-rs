# Backlog

Planned features and ideas, roughly in the order they are meant to be done.

## Bookmark follow-ups

Bookmarks are implemented (see the README). Possible next steps:

- Optional count-in before a jump (one bar from the BPM with the metronome), if starting
  exactly at the mark turns out to be too abrupt. A fixed 2 s pre-roll was tried and dropped:
  bookmarks can be placed precisely, so jumps go exactly there.
- A–B loop extras, if practice asks for them: a repeat count, or a short pause before each
  repeat to get the hands back in position.
- Foot pedal support (page-turner pedals often send arrow keys or PageUp/PageDown, which
  collide with the seek shortcuts).
- Tune the editor's shift step (now 0.25 s) after some practice with it.

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
- Section times could become bookmarks, and allow highlighting or
  auto-scrolling the current section.

## More ideas

Not designed yet; each needs more thought before it is started.

- **Auto-scroll synced to playback.** Simple version: scroll position = playback position /
  duration. Later: timestamps per section (see the LRCLIB idea above), so the sheet follows the
  song's structure.
