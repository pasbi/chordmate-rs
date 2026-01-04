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
