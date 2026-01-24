import Song from "types/Song";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@apollo/client/react";
import GetSongsData from "../types/GetSongsData";
import { gql } from "@apollo/client";
import { GET_SONGS } from "../graphql";

export default function SongsList() {
  const { data, loading, error } = useQuery<GetSongsData>(GET_SONGS);

  if (loading) return <p>Loading songs...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div className="p-4">
      <h2>🎵 Songs</h2>
      <ul>
        {data?.songs?.map((song: Song) => (
          <li key={song.id}>
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
