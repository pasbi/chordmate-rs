import { gql } from "@apollo/client";

export const GET_SONGS = gql`
  query GetSongs {
    songs {
      id
      title
      artist
      spotifyTrack
    }
  }
`;

export const DELETE_SONG = gql`
  mutation DeleteSong($id: Int!) {
    deleteSong(id: $id)
  }
`;
