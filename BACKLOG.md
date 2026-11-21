# Backlog

Planned features and ideas, roughly in the order they are meant to be done.

## Bookmark follow-ups

Bookmarks are implemented (see the README). Possible next step:

- Foot pedal support (page-turner pedals often send arrow keys or PageUp/PageDown, which
  collide with the seek shortcuts).

Decided against: a count-in before a jump, a repeat count or pause for A–B loops, and other
shift steps than 0.25 s. Placing A a little before a passage and B a little after it gives the
lead-in and the pause; the loop switch ends a loop; a bookmark further away is set anew.

## Section timestamps from LRCLIB

Spotify provides no labeled sections: Audio Analysis only had unlabeled sections and is
deprecated since November 2024, and synced lyrics are not in the public Web API.

[LRCLIB](https://lrclib.net) is a free, open database of synced lyrics (LRC) with a simple
API that looks up a track by artist, title and duration, all of which are known from
Spotify. Fuzzy-matching the sheet's lyric lines to the timed LRC lines would give each
`[Verse]` / `[Chorus]` header the time of its first lyric line.

Auto-scroll is implemented with such times, set by hand (long-press a heading while the song
plays); LRCLIB would pre-fill them.

- Only a suggestion the user confirms or adjusts; setting them by hand stays the fallback.
- Instrumental parts (intro, solo, outro) have no lyrics and need manual input.
- Repeated choruses must be matched in order; abbreviated sheets (“Chorus 2×”) match poorly.
- Opt-in, since it sends artist and title to a third party.
- Section times could also become bookmarks.

## Access from outside home (VPN, Raspberry Pi)

Run ChordMate on the Raspberry Pi and reach it through a VPN, not publicly:

- **VPN:** the FRITZ!Box's built-in WireGuard server (FRITZ!OS 7.50 or newer), one connection
  per device or person; split tunneling, so that only home addresses go through the tunnel and
  Spotify's traffic stays direct. The Telekom connection has native IPv6 and most likely a
  public IPv4 address (to confirm: the Online-Monitor's IPv4 address equals
  `curl -4 https://ifconfig.me`). Every device needs its own WireGuard app: a phone's VPN
  doesn't cover what it shares by tethering. Friends: restrict their connections to the Pi.
- **Name and HTTPS:** `chordmate.<own domain>` pointing to the Pi's address in the home network
  (only reachable at home or through the VPN), with a Let's Encrypt certificate via the DNS
  challenge (Caddy; needs a DNS provider with an API). HTTPS also brings the screen wake lock,
  installing the app, and Spotify's player in the tablet's browser, which away from home
  replaces the PC's Spotify app.
- **ChordMate:** Caddy in front of frontend and backend under one address (the frontend then
  uses a relative backend address instead of port 3000), the Spotify app's redirect address
  set to the HTTPS one, the database moved with `backup.sh`. About half a day.
- **Not covered:** friends playing along with their own Spotify: ChordMate has a single Spotify
  login and no users, so they would play through the owner's account.
