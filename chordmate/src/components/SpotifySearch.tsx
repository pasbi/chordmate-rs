import { useState, useEffect, type ChangeEvent, useRef } from "react";
import { gql } from "@apollo/client";
import { useLazyQuery } from "@apollo/client/react";
import type { SpotifyTrack } from "../types/SpotifyTrack";
import { useDebounce } from "../hooks/useDebounce";
import { useLocation } from "react-router-dom";
import { GraphQLError } from "graphql/error";
import startSpotifyOauthFlow from "../spotifyoauth";
import { Modal } from "./Modal.tsx";
import Button from "./Button.tsx";
import { INPUT_CLASSES } from "./inputClasses.ts";

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

export default function SpotifySearch({
  initialQuery,
  onSelect,
  onClose,
}: {
  initialQuery: string;
  onSelect: (track: SpotifyTrack) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
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

  return (
    <Modal label="Select Spotify track" onClose={onClose} className="h-full">
      <div className="p-4 flex flex-col gap-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold">Select Spotify Track</h2>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          placeholder="Search Spotify tracks..."
          className={`w-full ${INPUT_CLASSES}`}
        />
      </div>

      {loading && <p className="px-4 pt-2 text-gray-500 dark:text-gray-400">Searching...</p>}
      {error && <p className="px-4 pt-2 text-red-500">Error fetching tracks</p>}

      <ul className="flex-1 overflow-auto p-2">
        {data?.searchSpotifyTracks.map((track: SpotifyTrack) => (
          <li key={track.id}>
            <button
              type="button"
              onClick={() => {
                onSelect(track);
                onClose();
              }}
              className="w-full text-left flex items-center gap-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-blue-500"
            >
              <img
                src={track.albumArt ?? undefined}
                alt=""
                className="w-12 h-12 rounded object-cover shrink-0"
              />
              <span className="flex flex-col overflow-hidden">
                <span className="font-medium truncate" title={track.name}>
                  {track.name}
                </span>
                <span
                  className="text-sm text-gray-500 dark:text-gray-400 truncate"
                  title={track.artists.join(", ")}
                >
                  {track.artists.join(", ")}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="p-4 flex justify-end border-t border-gray-200 dark:border-gray-700">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
