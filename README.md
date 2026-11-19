# Chordmate

A web app for keeping chord sheets for your songs and playing along with them.
Each song has a chord/lyrics sheet, an attached Spotify track that plays in the
browser, and a BPM with a metronome.

## Features

- Song library: create, edit and delete songs (title, artist, album art, BPM).
- Chord sheets in [ChordPro](https://www.chordpro.org) (`[Am]Lyrics go [F]here`,
  `{c: Chorus}`), shown with each chord above its syllable. Chords above lyrics,
  as pasted from Ultimate Guitar, are converted on paste (undo once to keep the
  pasted text). Songs saved in the old format are converted with
  `npm run convert-songs` (in `chordmate/`; dry run unless `--apply` is given).
- Spotify search to link a song to a track; in-browser playback through the
  Spotify Web Playback SDK (requires Spotify Premium).
- Playback on another Spotify device instead: a tablet can show the sheet and
  remote-control the Spotify desktop app on the PC (see below).
- Seeking with the arrow keys (±1 s, with Ctrl ±10 s), metronome with tap tempo, and per-device font
  size and volume; the screen stays on while a song is open.
- Bookmarks to practice a passage: 🔖+ (or `B`) marks the current position, ↺ (or
  `R`) jumps back to the active bookmark and plays. Markers above the slider
  show the bookmarks, the active one in amber with its name. Clicking a marker
  (or choosing it in the ▾ menu) makes it active and moves there;
  right-clicking or long-pressing it (or ✎ in the ▾ menu) renames, shifts,
  plays or deletes it. A bookmark without a name shows its current time.
  A–B loop: with a bookmark active, ⇥ (or `E`) sets its loop end B at the
  current position (again to move it). Played from within the passage, playback
  returns to the bookmark at B, again and again; the slider's bar shows the
  passage in amber. The bookmark's editor shifts or removes B.
  Bookmarks belong to the song's current Spotify track: linking another track
  hides them, linking the old one again brings them back. With no bookmark
  active, ↺ returns to where Play was last pressed.
- Song list with search, sorting (remembered per device) and grouping by artist.
- Light/dark theme following the system setting.

Planned features are described in [BACKLOG.md](BACKLOG.md).

## Architecture

| Directory    | What                                                                         |
|--------------|------------------------------------------------------------------------------|
| `backend/`   | Rust service (axum + juniper) exposing a GraphQL API on port 3000            |
| `chordmate/` | React + TypeScript frontend (Vite, Apollo Client, Tailwind, TipTap)          |
| `backend/migrations/` | PostgreSQL schema migrations, applied with refinery                 |

The backend serves:

- `/graphql` – GraphQL endpoint (queries: `songs`, `song`, `bookmarks`,
  `searchSpotifyTracks`; mutations: `addSong`, `deleteSong`, `updateSongContent`,
  `updateSongTrack`, `updateSongMeta`, `addBookmark`, `updateBookmark`,
  `deleteBookmark`)
- `/graphiql`, `/playground` – interactive GraphQL explorers
- `/spotify`, `/callback` – Spotify OAuth configuration and redirect target

The frontend talks to the backend at `http://<current hostname>:3000`.

## Configuration

### Root `.env` (used by `docker compose`)

```
POSTGRES_PASSWORD=...
PGADMIN_DEFAULT_EMAIL=...
PGADMIN_DEFAULT_PASSWORD=...
```

### `backend/.env`

The backend needs Spotify app credentials. Create an app in the
[Spotify developer dashboard](https://developer.spotify.com/dashboard) and add
the backend's `/callback` URL as a redirect URI. Spotify accepts plain HTTP only
for loopback IP addresses, and rejects `localhost`, so use `127.0.0.1`:

```
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/callback
```

### Spotify login

The backend holds a single Spotify login that all devices share. Log in once
from a browser on the machine running the backend; other devices on the
network then pick up the token automatically. The refresh token is stored in
the database, so the login survives backend restarts.

### Playing on another device

Under 🔊 on a song page, *Play on* lists your Spotify devices. Choose e.g. the
Spotify desktop app on the PC to use a tablet without audio output as display
and remote control; the choice is remembered per device. Switching devices
moves the current playback along. The desktop app has to be running and logged
in with the same Spotify account.

Database settings are passed as command-line flags or environment variables:

| Flag            | Env var          |
|-----------------|------------------|
| `--db-host`     | `DB_HOST`        |
| `--db-port`     | `DB_PORT`        |
| `--db-name`     | `DB_NAME`        |
| `--db-user`     | `DB_USER`        |
| `--db-password` | `DB_PASSWORD`    |
| `--port`        | `CHORDMATE_PORT` |
| `--log-level`   | –                |

## Development

Requirements: Docker (with compose), Rust, and Node.js 20 (see `chordmate/.nvmrc`).

```bash
scripts/dev.sh
```

starts PostgreSQL (port 5432) and pgAdmin (http://localhost:15080) in Docker,
applies the migrations, and runs the backend (port 3000) and the Vite dev server
(port 5173, also reachable from other devices on the network). Press `r` to
rebuild and restart the backend, `q` or Ctrl+C to stop everything. While it
runs, the PC doesn't go to sleep (`systemd-inhibit`).

To run the parts by hand instead: `docker compose --profile dev up`, then in
`backend/` `cargo run --bin migrate -- <db flags>` and
`cargo run --bin chordmate -- <db flags> --port 3000`, and in `chordmate/`
`npm run dev -- --host`.

### Backups

```bash
scripts/backup.sh
```

dumps the running database (dev or prod) to `chordmate-<date>-<time>.dump`,
without the Spotify login. The restore command is in the script's header.

### Frontend scripts

| Command          | Purpose                    |
|------------------|----------------------------|
| `npm run dev`    | Dev server with hot reload |
| `npm run build`  | Type-check and build       |
| `npm run lint`   | ESLint                     |
| `npm test`       | Vitest unit tests          |

## Production

Builds and starts the database, backend and an nginx-served frontend, in the
foreground and without letting the PC sleep. New migrations are applied before
the backend starts. Ctrl+C stops and removes the containers; the database volume
stays:

```bash
scripts/prod.sh
```

The app is then available at http://localhost:8080 (backend on port 3000).

## Keyboard shortcuts

Outside of edit mode, on a song page:

| Key                 | Action                                  |
|---------------------|-----------------------------------------|
| Space               | Play / pause                            |
| ← / →               | Seek 1 s back / forward                 |
| Ctrl + ← / Ctrl + → | Seek 10 s back / forward                |
| B                   | Add a bookmark here                     |
| E                   | Set the active bookmark's loop end here |
| R                   | Back to the active bookmark             |
| ↑ / ↓               | Scroll the chord sheet                  |
| Esc                 | Close a dialog or popover               |
