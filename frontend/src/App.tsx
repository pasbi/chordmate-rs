import React, {useState} from 'react';
import './App.css';
import {ApolloClient, InMemoryCache, gql, HttpLink} from "@apollo/client";
import {ApolloProvider} from "@apollo/client/react";
import {useQuery, useMutation} from "@apollo/client/react";

const link = new HttpLink({
    uri: `http://${window.location.hostname}:3000/graphql`, // your Rust backend
});

const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
})

interface Song {
    id: string;
    title: string;
    artist: string;
    spotify_track: string;
    content: string;
}

interface GetSongsData {
    songs: Song[];
}

interface AddSongMutationData {
    addSong: {
        id: string;
        title: string;
        artist: string;
    };
}

interface AddSongMutationVars {
    title: string;
    artist: string;
}

const GET_SONGS = gql`
    query GetSongs {
        songs {
            id
            title
            artist
        }
    }`;

const ADD_SONG = gql`
    mutation AddSong($title: String!, $artist: String!) {
        addSong(title: $title, artist: $artist ) {
            id
            title
            artist
        }
    }
`

function SongsList() {
    const {loading, error, data} = useQuery<GetSongsData>(GET_SONGS);
    if (loading) return <p>Loading songs...</p>;
    if (error) return <p>Error: {error.message}</p>;
    if (!data) return <p>No data available</p>;

    return (
        <div className="p-4">
            <h2>🎵 Songs</h2>
            <ul>
                {data.songs.map((song: any) => (
                    <li key={song.id}>
                        <strong>{song.title || "(untitled)"}</strong> — {song.artist || "unknown"}
                    </li>
                ))}
            </ul>
        </div>
    );
}

interface AddSongFormProps {
    onSongAdded: (newSong: { id: string; title: string; artist: string }) => void;
}

function SongForm({onSongAdded}: AddSongFormProps) {
    const [title, setTitle] = useState("");
    const [artist, setArtist] = useState("");
    const [addSong, {data, loading, error}] = useMutation(ADD_SONG);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await addSong({variables: {title, artist}});
    };
    return (
        <form onSubmit={handleSubmit}>
            <input
                type="text"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
            />
            <input
                type="text"
                placeholder="Artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                required
            />
            <button type="submit" disabled={loading}>
                Add Song
            </button>
            {error && <p style={{color: "red"}}>Error: {error.message}</p>}
        </form>
    );
}

function App() {
    return (
        <ApolloProvider client={client}>
            <main style={{fontFamily: "sans-serif", padding: "1rem"}}>
                <h1>My GraphQL Music App</h1>
                <SongForm onSongAdded={function () {
                }}/>
                <SongsList/>
            </main>
        </ApolloProvider>
    );
}

export default App;
