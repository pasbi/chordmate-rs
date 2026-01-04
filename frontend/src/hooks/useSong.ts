import { useMutation, useQuery } from "@apollo/client/react";
import GetSongData from "../types/GetSongData";
import { gql } from "@apollo/client";

const GET_SONG = gql`
  query GetSong($id: Int!) {
    song(id: $id) {
      id
      title
      artist
      content
      spotifyTrack
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

interface UpdateSongTrackVars {
  id: number;
  track: string;
}

const UPDATE_SONG_TRACK = gql`
  mutation UpdateSongContent($id: Int!, $track: String!) {
    updateSongTrack(id: $id, track: $track)
  }
`;

export default function useSong(id: number) {
  const { data, loading, error } = useQuery<GetSongData>(GET_SONG, {
    variables: { id },
  });

  const [updateSongContent] = useMutation<
    UpdateSongContentData,
    UpdateSongContentVars
  >(UPDATE_SONG_CONTENT);

  const [updateSongTrack] = useMutation<
    UpdateSongTrackData,
    UpdateSongTrackVars
  >(UPDATE_SONG_TRACK);

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

  return {
    song: data?.song,
    loading,
    error,
    saveContent,
    saveTrack,
  };
}
