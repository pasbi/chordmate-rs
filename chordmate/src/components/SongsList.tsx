import type Song from "../types/Song";
import { useQuery } from "@apollo/client/react";
import type GetSongsData from "../types/GetSongsData";
import { GET_SONGS } from "../graphql";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SongForm from "./SongForm";
import { INPUT_CLASSES } from "./inputClasses";

type SortField = "id" | "title" | "artist";

const SORT_FIELD_LABELS: Record<SortField, string> = {
  id: "Added",
  title: "Title",
  artist: "Artist",
};

function compareText(a: string, b: string) {
  return a.toLowerCase().localeCompare(b.toLowerCase());
}

function compareSongs(a: Song, b: Song, field: SortField) {
  switch (field) {
    case "id":
      return a.id - b.id;
    case "title":
      return compareText(a.title, b.title);
    case "artist":
      // Within an artist, songs are ordered by title.
      return compareText(a.artist, b.artist) || compareText(a.title, b.title);
  }
}

type ArtistGroup = { artist: string; songs: Song[] };

/** Splits songs that are already sorted by artist into one group per artist. */
function groupByArtist(songs: Song[]) {
  const groups: ArtistGroup[] = [];
  for (const song of songs) {
    const current = groups.at(-1);
    if (current && compareText(current.artist, song.artist) === 0) {
      current.songs.push(song);
    } else {
      groups.push({ artist: song.artist, songs: [song] });
    }
  }
  return groups;
}

function matchesFilter(song: Song, filter: string) {
  const needle = filter.toLowerCase();
  return [song.title, song.artist].some((value) => value.toLowerCase().includes(needle));
}

function SongRow({ song, showArtist }: { song: Song; showArtist: boolean }) {
  return (
    <li>
      <Link
        to={`/songs/${song.id}`}
        className="flex items-center gap-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        {song.albumArtUrl ? (
          <img className="w-12 h-12 rounded object-cover shrink-0" src={song.albumArtUrl} alt="" />
        ) : (
          <div className="w-12 h-12 rounded shrink-0 bg-gray-200 dark:bg-gray-700" />
        )}
        <div className="flex flex-col min-w-0">
          <span className="font-medium truncate">{song.title || "Untitled"}</span>
          {showArtist && (
            <span className="text-sm truncate text-gray-600 dark:text-gray-400">{song.artist}</span>
          )}
        </div>
      </Link>
    </li>
  );
}

export default function SongsList() {
  const { data, loading, error } = useQuery<GetSongsData>(GET_SONGS);

  const [filter, setFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("id");
  const [sortAscending, setSortAscending] = useState(true);

  const displayedSongs = useMemo(() => {
    const direction = sortAscending ? 1 : -1;
    return (data?.songs ?? [])
      .filter((song) => matchesFilter(song, filter))
      .sort((a, b) => direction * compareSongs(a, b, sortField));
  }, [data, filter, sortField, sortAscending]);

  if (loading) return <p className="p-4">Loading songs...</p>;
  if (error) return <p className="p-4">Error: {error.message}</p>;

  return (
    <div className="w-full px-2 sm:px-4 md:max-w-xl md:mx-auto">
      <div className="sticky top-0 z-10 flex flex-wrap gap-2 py-2 bg-white dark:bg-gray-900">
        <input
          type="search"
          placeholder="Search title or artist"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={`flex-1 min-w-40 ${INPUT_CLASSES}`}
        />
        <select
          aria-label="Sort by"
          value={sortField}
          onChange={(e) => setSortField(e.target.value as SortField)}
          className={INPUT_CLASSES}
        >
          {Object.entries(SORT_FIELD_LABELS).map(([field, label]) => (
            <option key={field} value={field}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          title={sortAscending ? "Ascending" : "Descending"}
          onClick={() => setSortAscending(!sortAscending)}
          className={`w-10 ${INPUT_CLASSES}`}
        >
          {sortAscending ? "↑" : "↓"}
        </button>
        <SongForm />
      </div>

      <ul className="flex flex-col">
        {sortField === "artist"
          ? groupByArtist(displayedSongs).map((group) => (
              <li key={group.artist.toLowerCase()}>
                <h2 className="px-2 pt-4 pb-1 text-sm font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  {group.artist || "Unknown artist"}
                </h2>
                <ul className="flex flex-col">
                  {group.songs.map((song) => (
                    <SongRow key={song.id} song={song} showArtist={false} />
                  ))}
                </ul>
              </li>
            ))
          : displayedSongs.map((song) => <SongRow key={song.id} song={song} showArtist={true} />)}
      </ul>
      {displayedSongs.length === 0 && <p className="text-center py-4">No songs found</p>}
    </div>
  );
}
