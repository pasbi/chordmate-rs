import { useState, useEffect, type ChangeEvent, useRef } from "react";
import { gql } from "@apollo/client";
import { useLazyQuery } from "@apollo/client/react";
import type { SpotifyTrack } from "../types/SpotifyTrack";
import { useDebounce } from "../hooks/useDebounce";
import styles from "./SpotifySearch.module.css";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { GraphQLError } from "graphql/error";
import startSpotifyOauthFlow from "../spotifyoauth";
import useSong from "../hooks/useSong.ts";
import { songLabel } from "../types/Song.ts";

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

export async function handleError(error: unknown, currentPath: string) {
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

export default function SpotifySearch() {
  const { id } = useParams();
  const { song, saveTrack, saveSongMeta } = useSong(parseInt(id!));
  const [query, setQuery] = useState(songLabel(song));
  const [search, { data, loading, error }] = useLazyQuery<
    SearchSpotifyTracksData,
    SearchSpotifyTracksVars
  >(SPOTIFY_SEARCH_TRACKS);
  const debouncedQuery = useDebounce(query, 500);
  const navigate = useNavigate();
  const location = useLocation();
  const urlSearchParams = new URLSearchParams(location.search);
  const initialSearch = useRef(urlSearchParams.get("init") === "true");

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
    if (initialSearch.current) {
      saveSongMeta(track.name, track.artists);
    }
  }

  return (
    <div className={styles.modal}>
      <h2>Select Spotify Track</h2>
      <input
        ref={inputRef}
        value={query}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
        placeholder="Search Spotify tracks..."
      />

      {loading && <p>Searching...</p>}
      {error && <p>Error fetching tracks</p>}
      <ul>
        {data?.searchSpotifyTracks.map((track: SpotifyTrack) => (
          <li
            className={styles.trackItem}
            key={track.id}
            onClick={() => {
              setTrack(track);
              navigate(`/songs/${id}`, { replace: true });
            }}
          >
            <img className={styles.trackAlbum} src={track.albumArt ?? null} alt="" width="50" />
            <div className={styles.trackTitle}>{track.name}</div>
            <div className={styles.trackArtists}>{track.artists.join(", ")}</div>
          </li>
        ))}
      </ul>
      <button onClick={() => navigate("..")}>Cancel</button>
    </div>
  );
}
