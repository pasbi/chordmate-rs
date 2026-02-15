import { useState, useEffect, type ChangeEvent, useRef } from "react";
import { gql } from "@apollo/client";
import { useLazyQuery } from "@apollo/client/react";
import type { SpotifyTrack } from "../types/SpotifyTrack";
import { useDebounce } from "../hooks/useDebounce";
import { useLocation, useParams } from "react-router-dom";
import { GraphQLError } from "graphql/error";
import startSpotifyOauthFlow from "../spotifyoauth";
import useSong from "../hooks/useSong.ts";
import { songLabel } from "../types/Song.ts";
import { Modal } from "./Modal.tsx";

export const SPOTIFY_SEARCH_TRACKS = gql`
  query SearchSpotifyTracks($query: String!) {
    searchSpotifyTracks(query: $query) {
      id
      name
      artists
      previewUrl
      albumArt
    }
  }
`;

type SearchSpotifyTracksData = {
  searchSpotifyTracks: SpotifyTrack[];
};

type SearchSpotifyTracksVars = {
  query: string;
};

async function handleError(error: unknown, currentPath: string) {
  if (!error || typeof error !== "object" || !("errors" in error)) {
    return;
  }

  const errors = (error as { errors: GraphQLError[] }).errors;
  const unauthenticated = errors.some((e) => {
    return e.extensions.code === "UNAUTHENTICATED";
  });
  if (unauthenticated) {
    startSpotifyOauthFlow(currentPath);
  }
}

export default function SpotifySearch({ onClose }: { onClose: () => void }) {
  const { id } = useParams();
  const { song, saveTrack } = useSong(parseInt(id!));
  const [query, setQuery] = useState(songLabel(song));
  const [search, { data, loading, error }] = useLazyQuery<
    SearchSpotifyTracksData,
    SearchSpotifyTracksVars
  >(SPOTIFY_SEARCH_TRACKS);
  const debouncedQuery = useDebounce(query, 500);
  const location = useLocation();

  // Auto-run search for initial suggestion
  useEffect(() => {
    if (debouncedQuery.trim() === "") {
      return;
    }
    search({ variables: { query: debouncedQuery } });
  }, [debouncedQuery, search]);

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    handleError(error, window.location.origin + location.pathname + location.search).catch(
      console.error
    );
  }, [error, location.pathname, location.search]);

  if (!song) {
    return <div>Song undefined.</div>;
  }

  function setTrack(track: SpotifyTrack) {
    if (!song) {
      return;
    }
    saveTrack(track.id);
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-xl font-semibold mb-2 p-4 text-gray-900 dark:text-gray-100">
        Select Spotify Track
      </h2>

      <div className="px-4 mb-2">
        <input
          ref={inputRef}
          value={query}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          placeholder="Search Spotify tracks..."
          className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading && <p className="px-4 text-gray-500 dark:text-gray-400 mb-2">Searching...</p>}
      {error && <p className="px-4 text-red-500 mb-2">Error fetching tracks</p>}

      <ul className="flex-1 overflow-auto px-4 space-y-2">
        {data?.searchSpotifyTracks.map((track: SpotifyTrack) => (
          <li
            key={track.id}
            onClick={() => {
              setTrack(track);
              onClose();
            }}
            className="flex items-center gap-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
          >
            <img
              src={track.albumArt ?? undefined}
              alt={track.name}
              className="w-12 h-12 rounded object-cover shrink-0"
            />
            <div className="flex flex-col overflow-hidden">
              <span
                className="font-medium text-gray-900 dark:text-gray-100 truncate"
                title={track.name}
              >
                {track.name}
              </span>
              <span
                className="text-sm text-gray-500 dark:text-gray-400 truncate"
                title={track.artists.join(", ")}
              >
                {track.artists.join(", ")}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="px-4 py-2">
        <button
          onClick={() => onClose()}
          className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}
