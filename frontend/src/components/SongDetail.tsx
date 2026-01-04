import React from "react";
import { useParams } from "react-router-dom";
import styles from "./SongDetail.module.css";
import Editor from "components/Editor";
import SpotifyTrack from "types/SpotifyTrack";
import SpotifySearchModal from "./SpotifySearchModal";
import SpotifyPlayer from "./SpotifyPlayer";
import useSong from "../hooks/useSong";
import useTrackInfo from "../hooks/useTrackInfo";
import { useAccessToken } from "../hooks/useAccessToken";

export default function SongDetail() {
  const { id: idString } = useParams<{ id: string }>();
  const id = parseInt(idString!);
  const { song, loading, error, saveContent, saveTrack, saveSongMeta } =
    useSong(id);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editorContent, setEditorContent] = React.useState<string>("");

  const accessToken = useAccessToken();
  const trackInfo = useTrackInfo(song?.spotifyTrack ?? "", accessToken);

  React.useEffect(() => {
    if (song) {
      setEditorContent(song.content);
    }
  }, [song]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  if (!song) return <p>Song not found</p>;

  const handleTrackSelected = async (track: SpotifyTrack) => {
    await saveTrack(track.id);
    setModalOpen(false);
  };

  const setSongInfoFromTrack = () => {
    void saveSongMeta(
      trackInfo?.title ?? "",
      trackInfo?.artists.join(", ") ?? "",
    );
  };

  return (
    <div className={styles.songDetailContainer}>
      <header>
        <hgroup>
          <h1>{song.title}</h1>
          <p>{song.artist}</p>
        </hgroup>
        <SpotifyPlayer trackId={song.spotifyTrack} />
        <div className={styles.tools}>
          <button onClick={() => setModalOpen(true)}>Link Spotify Track</button>
          <button onClick={setSongInfoFromTrack}>Use Track Info</button>
          <button onClick={() => saveContent(editorContent)}>Save</button>
        </div>
        {modalOpen && (
          <SpotifySearchModal
            initialQuery={`${song.title} ${song.artist}`}
            onSelect={handleTrackSelected}
            onClose={() => setModalOpen(false)}
          />
        )}
      </header>
      <Editor content={song.content} onUpdate={setEditorContent} />
    </div>
  );
}
