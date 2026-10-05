# Chordmate

A web app for keeping chord sheets for your songs and playing along with them.
Each song has a chord/lyrics sheet, an attached Spotify track that plays in the
browser, and a BPM with a metronome.

## Features

- Song library: create, edit and delete songs (title, artist, album art, BPM).
- Chord sheet editor that recognizes chord lines (`Am  F  C  G`, slash chords,
  `N.C.`, …) and section headers (`[Verse]`, `[Chorus]`) and highlights them.
- Spotify search to link a song to a track; in-browser playback through the
  Spotify Web Playback SDK (requires Spotify Premium).
- Metronome with a tap-tempo button that blinks on the beat.
- Light/dark theme following the system setting.

## Architecture

| Directory    | What                                                                         |
|--------------|------------------------------------------------------------------------------|
| `backend/`   | Rust service (axum + juniper) exposing a GraphQL API on port 3000            |
| `chordmate/` | React + TypeScript frontend (Vite, Apollo Client, Tailwind, TipTap)          |
| `backend/migrations/` | PostgreSQL schema migrations, applied with refinery                 |

The backend serves:

- `/graphql` – GraphQL endpoint (queries: `songs`, `song`, `searchSpotifyTracks`;
  mutations: `addSong`, `deleteSong`, `updateSongContent`, `updateSongTrack`,
  `updateSongMeta`)
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
the backend's `/callback` URL as a redirect URI.

```
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
```

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

1. Start PostgreSQL (port 5432) and pgAdmin (http://localhost:15080):

   ```bash
   docker compose --profile dev up
   ```

2. Apply the database migrations:

   ```bash
   cd backend && cargo run --bin migrate -- --db-host localhost --db-port 5432 --db-name postgres --db-user postgres --db-password <POSTGRES_PASSWORD>
   ```

3. Run the backend:

   ```bash
   cd backend && cargo run --bin chordmate -- --db-host localhost --db-port 5432 --db-name postgres --db-user postgres --db-password <POSTGRES_PASSWORD> --port 3000
   ```

4. Run the frontend; Vite prints the URL to open:

   ```bash
   cd chordmate && npm install && npm run dev
   ```

### Frontend scripts

| Command          | Purpose                    |
|------------------|----------------------------|
| `npm run dev`    | Dev server with hot reload |
| `npm run build`  | Type-check and build       |
| `npm run lint`   | ESLint                     |
| `npm test`       | Vitest unit tests          |

## Production

Builds and starts the database, backend and an nginx-served frontend:

```bash
docker compose --profile prod up --build
```

The app is then available at http://localhost:8080 (backend on port 3000).
Note: migrations are not applied automatically in this setup, and the production
database is not exposed on the host, so the schema has to be created by running
the `migrate` binary from inside the compose network.

## Keyboard shortcuts

Outside of edit mode, on a song page:

| Key                   | Action                    |
|-----------------------|---------------------------|
| Space                 | Play / pause              |
| ← / →                 | Seek 1 s back / forward   |
| Ctrl + ← / Ctrl + →   | Seek 10 s back / forward  |
