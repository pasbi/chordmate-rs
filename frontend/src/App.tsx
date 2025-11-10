import React from 'react';
import './App.css';
import {ApolloClient, InMemoryCache, gql, HttpLink} from "@apollo/client";
import {ApolloProvider} from "@apollo/client/react";
import {useQuery} from "@apollo/client/react";

const link = new HttpLink({
  uri: "http://localhost:3000/graphql", // your Rust backend
});

const client = new ApolloClient({
    link,
    cache: new InMemoryCache(),
})

interface Song {
  id: string;
  title: string ;
  artist: string ;
  spotify_track_id: string ;
  content: string ;
}

interface GetSongsData {
  songs: Song[];
}

const GET_SONGS = gql`
query GetSongs {
    songs {
        id
        title
    }
}`;

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

function App() {
  return (
      <ApolloProvider client={client}>
      <main style={{ fontFamily: "sans-serif", padding: "1rem" }}>
        <h1>My GraphQL Music App</h1>
        <SongsList />
      </main>
    </ApolloProvider>
  );
}

export default App;
