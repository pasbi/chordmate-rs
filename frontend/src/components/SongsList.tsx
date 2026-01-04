import Song from "types/Song";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@apollo/client/react";
import GetSongsData from "../types/GetSongsData";
import { gql } from "@apollo/client";

const DELETE_SONG = gql`
  mutation DeleteSong($id: Int!) {
    deleteSong(id: $id)
  }
`;
const GET_SONGS = gql`
  query GetSongs {
    songs {
      id
      title
      artist
    }
  }
`;

export default function SongsList() {
  const { data, loading, error } = useQuery<GetSongsData>(GET_SONGS);
  const [deleteSong] = useMutation(DELETE_SONG);

  const handleDelete = async (id: number) => {
    await deleteSong({
      variables: { id },
      refetchQueries: [{ query: GET_SONGS, variables: {} }],
    });
  };

  if (loading) return <p>Loading songs...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div className="p-4">
      <h2>🎵 Songs</h2>
      <ul>
        {data?.songs?.map((song: Song) => (
          <li key={song.id}>
            <button onClick={() => handleDelete(song.id)}>Delete</button>
            &nbsp;
            <Link to={`/songs/${song.id}`}>
              <strong>{song.title || "(untitled)"}</strong> —{" "}
              {song.artist || "unknown"}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
