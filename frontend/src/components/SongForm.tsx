import React, { useRef } from "react";
import { useMutation } from "@apollo/client/react";
import { gql } from "@apollo/client";
import Song from "../types/Song";

const GET_SONGS = gql`
  query GetSongs {
    songs {
      id
      title
      artist
    }
  }
`;

const ADD_SONG = gql`
  mutation AddSong($title: String!, $artist: String!) {
    addSong(title: $title, artist: $artist) {
      id
      title
      artist
    }
  }
`;

interface AddSongData {
  addSong: Song;
}

interface AddSongVars {
  title: string;
  artist: string;
}

export default function SongForm() {
  const titleInput = useRef<HTMLInputElement>(null);
  const artistInput = useRef<HTMLInputElement>(null);

  const [addSong] = useMutation<AddSongData, AddSongVars>(ADD_SONG);
  const handleSubmit = async () => {
    const title = titleInput.current!.value;
    const artist = artistInput.current!.value;
    await addSong({
      variables: { title, artist },
      refetchQueries: [{ query: GET_SONGS, variables: {} }],
    });
  };

  return (
    <div>
      <input ref={titleInput} type="text" placeholder="Title" />
      <input ref={artistInput} type="text" placeholder="Artist" />
      <button onClick={handleSubmit}>Add Song</button>
    </div>
  );
}
