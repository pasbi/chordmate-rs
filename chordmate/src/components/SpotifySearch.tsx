import { useState, useEffect, type ChangeEvent, type KeyboardEvent, useRef } from "react";
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

  // The results for what is typed now; older ones are still shown while new ones load.
  const tracks = data?.searchSpotifyTracks ?? [];
  const resultsCurrent = !loading && debouncedQuery === query && data !== undefined;

  // Enter picks the highlighted result, the first unless moved with ↑/↓. The highlight is tied to
  // its results, so that new results start at the first again.
  const [highlight, setHighlight] = useState({ tracks, index: 0 });
  const highlighted = highlight.tracks === tracks ? highlight.index : 0;
  const pick = (track: SpotifyTrack) => {
    onSelect(track);
    onClose();
  };
  // Enter pressed while the results are still loading picks the first one once they are there.
  // Typing again cancels it.
  const [pickWhenLoaded, setPickWhenLoaded] = useState(false);
  const firstTrack = resultsCurrent ? (tracks[0] ?? null) : null;
  const latestPick = useRef(pick);
  useEffect(() => {
    latestPick.current = pick;
  });
  useEffect(() => {
    if (pickWhenLoaded && firstTrack !== null) {
      latestPick.current(firstTrack);
    }
  }, [pickWhenLoaded, firstTrack]);
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const index = Math.min(Math.max(highlighted + step, 0), Math.max(tracks.length - 1, 0));
      setHighlight({ tracks, index });
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (resultsCurrent && tracks.length > 0) {
        pick(tracks[highlighted]);
      } else if (!resultsCurrent) {
        setPickWhenLoaded(true);
      }
    }
  };

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
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setQuery(e.target.value);
            setPickWhenLoaded(false);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search Spotify tracks..."
          title="Enter picks the highlighted track, ↑/↓ move the highlight"
          className={`w-full ${INPUT_CLASSES}`}
        />
      </div>

      {loading && <p className="px-4 pt-2 text-gray-500 dark:text-gray-400">Searching...</p>}
      {error && <p className="px-4 pt-2 text-red-500">Error fetching tracks</p>}

      <ul className="flex-1 overflow-auto p-2">
        {tracks.map((track: SpotifyTrack, index) => (
          <li key={track.id}>
            <button
              type="button"
              onClick={() => pick(track)}
              className={`w-full text-left flex items-center gap-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-blue-500 ${
                index === highlighted ? "bg-gray-100 dark:bg-gray-800" : ""
              }`}
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
