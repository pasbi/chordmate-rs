import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import styles from "./SongDetail.module.css";
import Editor from "components/Editor";
import SpotifyTrack from "types/SpotifyTrack";
import SpotifySearchModal from "./SpotifySearchModal";
import SpotifyPlayer, { TrackInfo } from "./SpotifyPlayer";
import useSong from "../hooks/useSong";
import useTrackInfo from "../hooks/useTrackInfo";
import { useAccessToken } from "../hooks/useAccessToken";

export default function SongDetail() {
  const { id: idString } = useParams<{ id: string }>();

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  let init = useRef(queryParams.get("init") === "true");

  const id = parseInt(idString!);
  const { song, loading, error, saveContent, saveTrack, saveSongMeta } =
    useSong(id);
  const [modalOpen, setModalOpen] = useState(false);
  const closeSearch = () => {
    init.current = false;
    setModalOpen(false);
  };
  const [editorContent, setEditorContent] = useState<string>("");

  const accessToken = useAccessToken();
  const trackInfo = useTrackInfo(song?.spotifyTrack ?? "", accessToken);

  useEffect(() => {
    if (song) {
      setEditorContent(song.content);
    }
  }, [song]);

  useEffect(() => {
    if (init.current && song) {
      setModalOpen(true);
    }
  });

  let [updateSongInfoFromTrackLater, setUpdateSongInfoFromTrackLater] =
    useState(false);

  const setSongInfoFromTrack = (trackInfo: TrackInfo | null) => {
    void saveSongMeta(
      trackInfo?.title ?? "",
      trackInfo?.artists.join(", ") ?? "",
    );
  };
  const setSongInfoFromTrackRef = useRef(setSongInfoFromTrack);
  useEffect(() => {
    if (updateSongInfoFromTrackLater) {
      setSongInfoFromTrackRef.current(trackInfo);
    }
  }, [trackInfo, updateSongInfoFromTrackLater, setSongInfoFromTrackRef]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  if (!song) return <p>Song not found</p>;

  const handleTrackSelected = async (track: SpotifyTrack) => {
    if (init.current && song) {
      setUpdateSongInfoFromTrackLater(true);
    }
    await saveTrack(track.id);
    closeSearch();
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
          <button onClick={() => setSongInfoFromTrack(trackInfo)}>
            Use Track Info
          </button>
          <button onClick={() => saveContent(editorContent)}>Save</button>
        </div>
        {modalOpen && (
          <SpotifySearchModal
            initialQuery={`${song.title} ${song.artist}`}
            onSelect={handleTrackSelected}
            onClose={closeSearch}
          />
        )}
      </header>
      <Editor content={song.content} onUpdate={setEditorContent} />
    </div>
  );
}
