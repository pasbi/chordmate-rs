import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styles from "./SongDetail.module.css";
import Editor from "../components/Editor";
import SpotifyPlayer from "./SpotifyPlayer";
import useSong from "../hooks/useSong";
import useTrackInfo from "../hooks/useTrackInfo";
import { useAccessToken } from "../hooks/useAccessToken";

export default function SongDetail() {
  const { id: idString } = useParams<{ id: string }>();

  const navigate = useNavigate();

  const id = parseInt(idString!);
  const { song, loading, error, saveContent, saveSongMeta } = useSong(id);
  const [editorContent, setEditorContent] = useState<string>("");

  const accessToken = useAccessToken();
  const trackInfo = useTrackInfo(song?.spotifyTrack ?? "", accessToken);

  useEffect(() => {
    if (song) {
      setEditorContent(song.content);
    }
  }, [song]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  if (!song) return <p>Song not found</p>;

  return (
    <div className={styles.songDetailContainer}>
      <header>
        <hgroup>
          <h1>{song.title}</h1>
          <p>{song.artist}</p>
        </hgroup>
        <SpotifyPlayer trackId={song.spotifyTrack} />
        <div className={styles.tools}>
          <button onClick={() => navigate("search-spotify")}>Link Spotify Track</button>
          <button onClick={() => saveSongMeta(trackInfo?.title, trackInfo?.artists)}>
            Use Track Info
          </button>
          <button onClick={() => saveContent(editorContent)}>Save</button>
          <button onClick={() => navigate(`confirm-delete`)}>Delete</button>
        </div>
      </header>
      <Editor content={song.content} onUpdate={setEditorContent} />
    </div>
  );
}
