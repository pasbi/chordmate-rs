import React, {useEffect, useState} from 'react';
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
    id: number;
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

const DELETE_SONG = gql`
    mutation DeleteSong($id: Int!) {
        deleteSong(id: $id)
    }
`;

interface AddSongData {
    addSong: Song;
}

interface AddSongVars {
    title: string;
    artist: string;
}


function SongForm({onSongAdded}: { onSongAdded: (title: string, artist: string) => void }) {
    const [title, setTitle] = useState("");
    const [artist, setArtist] = useState("");
    return (
        <form>
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
            <button onClick={() => onSongAdded(title, artist)}>
                Add Song
            </button>
        </form>
    );
}

function SongsList({songs, onDelete}: { songs: Song[], onDelete: (id: number) => void }) {
    return (
        <div className="p-4">
            <h2>🎵 Songs</h2>
            <ul>
                {songs.map(song => (
                    <li key={song.id}>
                        <button onClick={() => onDelete(song.id)}>Delete</button>
                        &nbsp;
                        <strong>{song.title || "(untitled)"}</strong> — {song.artist || "unknown"}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function SongManager() {
    const [songs, setSongs] = useState<Song[]>([]);
    const {data, loading, error} = useQuery<GetSongsData>(GET_SONGS);
    const [deleteSong] = useMutation(DELETE_SONG);
    const [addSong] = useMutation<AddSongData, AddSongVars>(ADD_SONG);

    useEffect(() => {
        if (data?.songs) {
            setSongs(data.songs);
        }
    }, [data]);

    if (loading) return <p>Loading songs...</p>;
    if (error) return <p>Error: {error.message}</p>;
    if (!data) return <p>No data available</p>;

    const handleDelete = async (id: number) => {
        try {
            await deleteSong({variables: {id}});
            setSongs(prev => prev.filter(song => song.id !== id));
        } catch (err) {
            console.error("Failed to delete song:", err);
        }
    };

    const handleSubmit = async (title: string, artist: string) => {
        const {data} = await addSong({variables: {title, artist}});
        if (data?.addSong) {
            setSongs(prev => [...prev, data.addSong]);
        }
    };

    return (
        <div>
            <SongForm onSongAdded={handleSubmit}/>
            <SongsList songs={songs} onDelete={handleDelete}/>
        </div>
    )

}


function App() {
    return (
        <ApolloProvider client={client}>
            <main style={{fontFamily: "sans-serif", padding: "1rem"}}>
                <h1>My GraphQL Music App</h1>
                <SongManager/>
            </main>
        </ApolloProvider>
    );
}

export default App;
