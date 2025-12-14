import { useState, useEffect, ChangeEvent } from "react";
import { gql } from "@apollo/client";
import { useLazyQuery } from "@apollo/client/react";
import SpotifyTrack from "../types/SpotifyTrack";
import { useDebounce } from "../hooks/useDebounce";
import styles from "./SpotifySearchModal.module.css";
import { GraphQLError } from "graphql/error";
import { useLocation } from "react-router-dom";

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

interface SpotifySearchModalProps {
  initialQuery: string;
  onSelect: (track: any) => void; // Replace "any" with your Track type
  onClose: () => void;
}

async function startSpotifyOauthFlow(currentPath: string) {
  const clientId = await fetch(
    `http://${window.location.hostname}:3000/spotify-client-id`,
  ).then((res) => res.json());

  const redirectUri = await fetch(
    `http://${window.location.hostname}:3000/spotify-redirect-uri`,
  ).then((res) => res.json());

  console.log(`REduri: ${redirectUri}`)

  const scope = encodeURIComponent(
    "user-read-private user-read-email user-modify-playback-state user-read-playback-state",
  );

  const state = encodeURIComponent(currentPath);
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;
  window.location.href = authUrl;
}

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

export default function SpotifySearchModal({
  initialQuery,
  onSelect,
  onClose,
}: SpotifySearchModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [search, { data, loading, error }] = useLazyQuery<
    SearchSpotifyTracksData,
    SearchSpotifyTracksVars
  >(SPOTIFY_SEARCH_TRACKS);
  const debouncedQuery = useDebounce(query, 500);
  const location = useLocation();
  const currentPath =
    window.location.origin + location.pathname + location.search;

  // Auto-run search for initial suggestion
  useEffect(() => {
    if (debouncedQuery.trim() === "") {
      return;
    }
    search({ variables: { query: debouncedQuery } });
  }, [debouncedQuery, initialQuery]);

  useEffect(() => {
    handleError(error, currentPath).catch(console.error);
  }, [error]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h2>Select Spotify Track</h2>
        <button className="close-btn" onClick={onClose}>
          ×
        </button>
        <input
          value={query}
          onChange={handleChange}
          placeholder="Search Spotify tracks..."
        />

        {loading && <p>Searching...</p>}
        {error && <p>Error fetching tracks</p>}
        <ul>
          {data?.searchSpotifyTracks.map((track) => (
            <li
              className={styles.trackItem}
              key={track.id}
              onClick={() => onSelect(track)}
            >
              <img
                className={styles.trackAlbum}
                src={track.albumArt ?? null}
                alt=""
                width="50"
              />
              <div className={styles.trackTitle}>{track.name}</div>
              <div className={styles.trackArtists}>
                {track.artists.join(", ")}
              </div>
            </li>
          ))}
        </ul>

        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
