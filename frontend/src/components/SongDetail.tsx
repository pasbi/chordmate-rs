import React, { useEffect } from "react";
import { useParams } from "react-router-dom";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import GetSongData from "types/GetSongData";
import { Link } from "react-router-dom";
import "./SongDetail.css";
import Editor from "components/Editor";
import SpotifyTrack from "types/SpotifyTrack";
import SpotifySearchModal from "./SpotifySearchModal";
import SpotifyPlayer from "./SpotifyPlayer";

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

export default function SongDetail() {
  const { id: idString } = useParams<{ id: string }>();
  const id = parseInt(idString!);
  const { data, loading, error } = useQuery<GetSongData>(GET_SONG, {
    variables: { id },
  });
  console.log(`Details for song ${id}: ${JSON.stringify(data, null, 2)}`);
  const [updateSongContent] = useMutation<
    UpdateSongContentData,
    UpdateSongContentVars
  >(UPDATE_SONG_CONTENT);
  const [updateSongTrack] = useMutation<
    UpdateSongTrackData,
    UpdateSongTrackVars
  >(UPDATE_SONG_TRACK);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editorContent, setEditorContent] = React.useState<string>("");

  React.useEffect(() => {
    if (data?.song) {
      setEditorContent(data.song.content);
    }
  }, [data?.song?.content]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  if (!data?.song) return <p>Song not found</p>;
  const song = data.song;

  const save = async () => {
    console.log("Start saving");
    if (!id) {
      console.log("return early no id");
      return;
    }
    console.log(`id=${id}`);

    try {
      console.log(`mutation: id=${id}, content=${editorContent}`);
      await updateSongContent({
        variables: { id, content: editorContent },
        refetchQueries: [{ query: GET_SONG, variables: { id } }],
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleOpenModal = () => setModalOpen(true);
  const handleCloseModal = () => setModalOpen(false);

  const handleTrackSelected = (track: SpotifyTrack) => {
    console.log(`Selected: ${JSON.stringify(track)}`);
    updateSongTrack({ variables: { id: song.id, track: track.id } });
    handleCloseModal();
  };

  return (
    <div className="song-detail-container">
      <header>
        <h1>{song.title}</h1>
        <div>Artist: {song.artist}</div>
        <div>
          <Link to={"/"}>Back </Link>
        </div>
        <div>
          <button onClick={save}>Save</button>
        </div>
        <SpotifyPlayer trackUri={`spotify:track:${song.spotifyTrack}`} />
        <div>SpotifyTrack: {song.spotifyTrack}</div>
        <button onClick={handleOpenModal}>Link Spotify Track</button>
        {modalOpen && (
          <SpotifySearchModal
            initialQuery={`${song.title} ${song.artist}`}
            onSelect={handleTrackSelected}
            onClose={handleCloseModal}
          />
        )}
      </header>
      <Editor content={song.content} onUpdate={setEditorContent} />
    </div>
  );
}
