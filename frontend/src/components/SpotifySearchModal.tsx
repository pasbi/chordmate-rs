import {useState, useEffect, ChangeEvent} from "react";
import {gql} from "@apollo/client";
import {useLazyQuery} from "@apollo/client/react";
import SpotifyTrack from "../types/SpotifyTrack";
import {useDebounce} from "../hooks/useDebounce";
import styles from "./SpotifySearchModal.module.css";

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

export default function SpotifySearchModal({
                                               initialQuery,
                                               onSelect,
                                               onClose,
                                           }: SpotifySearchModalProps) {
    const [query, setQuery] = useState(initialQuery);
    const [search, {
        data,
        loading,
        error
    }] = useLazyQuery<SearchSpotifyTracksData, SearchSpotifyTracksVars>(SPOTIFY_SEARCH_TRACKS);
    const debouncedQuery = useDebounce(query, 500);

    // Auto-run search for initial suggestion
    useEffect(() => {
        if (debouncedQuery.trim() === "") {
            return;
        }
        search({variables: {query: debouncedQuery}});
    }, [debouncedQuery, initialQuery]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modal}>
                <h2>Select Spotify Track</h2>
                <button className="close-btn" onClick={onClose}>×</button>
                <input
                    value={query}
                    onChange={handleChange}
                    placeholder="Search Spotify tracks..."
                />

                {loading && <p>Searching...</p>}
                {error && <p>Error fetching tracks</p>}
                <ul>
                    {data?.searchSpotifyTracks.map(track => (
                        <li className={styles.trackItem} key={track.id} onClick={() => onSelect(track)}>
                            <img className={styles.trackAlbum} src={track.albumArt ?? null} alt="" width="50"/>
                            <div className={styles.trackTitle}>{track.name}</div>
                            <div className={styles.trackArtists}>{track.artists.join(", ")}</div>
                        </li>
                    ))}
                </ul>

                <button onClick={onClose}>Cancel</button>
            </div>
        </div>
    );
}
