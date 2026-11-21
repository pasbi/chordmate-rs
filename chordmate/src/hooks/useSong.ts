import { useEffect } from "react";
import type { Spelling } from "../lib/transpose.ts";
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
      transpose
      spelling
      lastViewedMs
    }
  }
`;

const MARK_SONG_VIEWED = gql`
  mutation MarkSongViewed($id: Int!) {
    markSongViewed(id: $id) {
      id
      lastViewedMs
    }
  }
`;

interface UpdateSongTransposeData {
  // The type name lets the optimistic response update the cached song.
  updateSongTranspose: { __typename: "Song"; id: number; transpose: number };
}
interface UpdateSongTransposeVars {
  id: number;
  transpose: number;
}

interface UpdateSongSpellingData {
  updateSongSpelling: { __typename: "Song"; id: number; spelling: Spelling };
}
interface UpdateSongSpellingVars {
  id: number;
  spelling: Spelling;
}

const UPDATE_SONG_SPELLING = gql`
  mutation UpdateSongSpelling($id: Int!, $spelling: String!) {
    updateSongSpelling(id: $id, spelling: $spelling) {
      id
      spelling
    }
  }
`;

const UPDATE_SONG_TRANSPOSE = gql`
  mutation UpdateSongTranspose($id: Int!, $transpose: Int!) {
    updateSongTranspose(id: $id, transpose: $transpose) {
      id
      transpose
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

  // Records the view once per opened song; the returned time updates the cached song list.
  const [markSongViewed] = useMutation(MARK_SONG_VIEWED);
  useEffect(() => {
    markSongViewed({ variables: { id } }).catch(console.error);
  }, [id, markSongViewed]);

  const [updateSongTranspose] = useMutation<UpdateSongTransposeData, UpdateSongTransposeVars>(
    UPDATE_SONG_TRANSPOSE
  );
  const [updateSongSpelling] = useMutation<UpdateSongSpellingData, UpdateSongSpellingVars>(
    UPDATE_SONG_SPELLING
  );

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

  // Applied to the cache at once, so that quickly repeated presses build on each other.
  const saveTranspose = async (transpose: number) => {
    await updateSongTranspose({
      variables: { id, transpose },
      optimisticResponse: { updateSongTranspose: { __typename: "Song", id, transpose } },
    });
  };

  const saveSpelling = async (spelling: Spelling) => {
    await updateSongSpelling({
      variables: { id, spelling },
      optimisticResponse: { updateSongSpelling: { __typename: "Song", id, spelling } },
    });
  };

  return {
    song: data?.song,
    loading,
    error,
    saveContent,
    saveTrack,
    saveSongMeta,
    saveTranspose,
    saveSpelling,
  };
}
