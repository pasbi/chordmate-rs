import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { GET_SONGS, ADD_SONG } from './graphql';

function App() {
  const { data, loading, error, refetch } = useQuery(GET_SONGS);
  const [addSong] = useMutation(ADD_SONG);

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [spotifyTrack, setSpotifyTrack] = useState('');

  const handleAdd = async () => {
    if (!title && !artist && !spotifyTrack) return;

    await addSong({ variables: { title, artist, spotifyTrack } });
    setTitle('');
    setArtist('');
    setSpotifyTrack('');
    refetch(); // refresh the list
  };

  if (loading) return <p>Loading songs...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Songs</h1>
      <ul>
        {data.songs.map((song: any) => (
          <li key={song.id}>
            {song.title || '[No title]'} by {song.artist || '[No artist]'}
            {song.spotifyTrack && ` (Spotify ID: ${song.spotifyTrack})`}
          </li>
        ))}
      </ul>

      <h2>Add a new song</h2>
      <input
        placeholder="Title"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />
      <input
        placeholder="Artist"
        value={artist}
        onChange={e => setArtist(e.target.value)}
      />
      <input
        placeholder="Spotify Track ID"
        value={spotifyTrack}
        onChange={e => setSpotifyTrack(e.target.value)}
      />
      <button onClick={handleAdd}>Add Song</button>
    </div>
  );
}

export default App;
