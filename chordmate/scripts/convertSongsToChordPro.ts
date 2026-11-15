/**
 * Converts all songs stored in an earlier format (chords above lyrics, editor HTML) to ChordPro
 * and tidies the whitespace of all songs, through the backend's GraphQL API. Running it again
 * changes nothing.
 *
 *   npm run convert-songs -- [--apply] [--show] [GRAPHQL_URL]
 *
 * Without --apply, only lists the songs that would change; --show also prints their new content.
 * Back up the database first (scripts/backup.sh).
 */
import { tidyChordPro } from "../src/lib/chordPro.ts";
import { normalizeSongContent } from "../src/lib/ultimateGuitar.ts";

interface Song {
  id: number;
  title: string;
  content: string;
}

const flags = new Set(process.argv.slice(2).filter((argument) => argument.startsWith("--")));
const url =
  process.argv.slice(2).find((argument) => !argument.startsWith("--")) ??
  "http://localhost:3000/graphql";

async function graphql<Data>(query: string, variables: Record<string, unknown>): Promise<Data> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const result = (await response.json()) as { data?: Data; errors?: unknown[] };
  if (!response.ok || result.errors || !result.data) {
    throw new Error(`GraphQL request failed: ${response.status} ${JSON.stringify(result.errors)}`);
  }
  return result.data;
}

async function loadSongs() {
  const { songs } = await graphql<{ songs: { id: number }[] }>("{ songs { id } }", {});
  const loaded: Song[] = [];
  for (const { id } of songs) {
    const { song } = await graphql<{ song: Song }>(
      "query($id: Int!) { song(id: $id) { id title content } }",
      { id }
    );
    loaded.push(song);
  }
  return loaded;
}

async function saveContent(id: number, content: string) {
  await graphql(
    "mutation($id: Int!, $content: String!) { updateSongContent(id: $id, content: $content) }",
    {
      id,
      content,
    }
  );
}

const songs = await loadSongs();
const changes = songs
  .map((song) => ({ song, converted: tidyChordPro(normalizeSongContent(song.content)) }))
  .filter(({ song, converted }) => converted !== song.content);

for (const { song, converted } of changes) {
  console.log(`${flags.has("--apply") ? "Converting" : "Would convert"} ${song.id}: ${song.title}`);
  if (flags.has("--show")) {
    console.log(`${converted}\n`);
  }
  if (flags.has("--apply")) {
    await saveContent(song.id, converted);
  }
}
console.log(
  `${changes.length} of ${songs.length} songs ${flags.has("--apply") ? "converted" : "to convert"}.`
);
