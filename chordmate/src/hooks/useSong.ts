import { useMutation, useQuery } from "@apollo/client/react";
import type GetSongData from "../types/GetSongData";
import { gql } from "@apollo/client";

const GET_SONG = gql`
  query GetSong($id: Int!) {
    song(id: $id) {
      id
      title
      artist
      content
      spotifyTrack
      albumArtUrl
      bpm
    }
  }
`;

interface UpdateSongContentData {
  updateSongContent: boolean;
}

interface UpdateSongContentVars {
  id: number;
  content: string;
}

const UPDATE_SONG_CONTENT = gql`
  mutation UpdateSongContent($id: Int!, $content: String!) {
    updateSongContent(id: $id, content: $content)
  }
`;

interface UpdateSongTrackData {
  updateSongTrack: boolean;
}
// TODO:
//  - font size
//  - auto scroll
//  - focus the search block
//  - space toggle start/pause even in spotifysearch

interface UpdateSongTrackVars {
  id: number;
  track: string;
}

const UPDATE_SONG_TRACK = gql`
  mutation UpdateSongContent($id: Int!, $track: String!) {
    updateSongTrack(id: $id, track: $track)
  }
`;

interface UpdateSongMetaData {
  updateSongMeta: boolean;
}

interface UpdateSongMetaVars {
  id: number;
  title: string;
  artist: string;
  albumArtUrl: string | null;
  bpm: number | null;
}

const UPDATE_SONG_META = gql`
  mutation UpdateSongContent(
    $id: Int!
    $title: String!
    $artist: String!
    $albumArtUrl: String
    $bpm: Float
  ) {
    updateSongMeta(id: $id, title: $title, artist: $artist, albumArtUrl: $albumArtUrl, bpm: $bpm)
  }
`;

export default function useSong(id: number) {
  const { data, loading, error } = useQuery<GetSongData>(GET_SONG, {
    variables: { id },
  });

  const [updateSongContent] = useMutation<UpdateSongContentData, UpdateSongContentVars>(
    UPDATE_SONG_CONTENT
  );

  const [updateSongTrack] = useMutation<UpdateSongTrackData, UpdateSongTrackVars>(
    UPDATE_SONG_TRACK
  );

  const [updateSongMeta] = useMutation<UpdateSongMetaData, UpdateSongMetaVars>(UPDATE_SONG_META);

  const saveContent = async (content: string) => {
    if (!id) return;
    await updateSongContent({
      variables: { id, content },
      refetchQueries: [{ query: GET_SONG, variables: { id } }],
    });
  };

  const saveTrack = async (trackId: string) => {
    if (!id) return;
    await updateSongTrack({
      variables: { id, track: trackId },
      refetchQueries: [{ query: GET_SONG, variables: { id } }],
    });
  };

  const saveSongMeta = async (
    title: string | null,
    artists: string[] | null,
    albumArtUrl: string | null,
    bpm: number | null
  ) => {
    if (!id) {
      return;
    }
    console.log(`Save Song Meta: ${title} ${bpm}`);
    await updateSongMeta({
      variables: {
        id,
        title: title ?? "",
        artist: artists?.join(", ") ?? "",
        albumArtUrl: albumArtUrl,
        bpm: bpm,
      },
      refetchQueries: [{ query: GET_SONG, variables: { id } }],
    });
  };

  return {
    song: data?.song,
    loading,
    error,
    saveContent,
    saveTrack,
    saveSongMeta,
  };
}
