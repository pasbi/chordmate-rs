import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Editor from "../components/Editor";
import SpotifyPlayer from "./SpotifyPlayer";
import useSong from "../hooks/useSong";
import useTrackInfo from "../hooks/useTrackInfo";
import { useAccessToken } from "../hooks/useAccessToken";
import SpotifySearch from "./SpotifySearch.tsx";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog.tsx";
import Button from "./Button.tsx";

export default function SongDetail() {
  const { id: idString } = useParams<{ id: string }>();
  const id = parseInt(idString!);
  const { song, loading, error, saveContent, saveSongMeta } = useSong(id);
  const [editorContent, setEditorContent] = useState<string>("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const accessToken = useAccessToken();
  const trackInfo = useTrackInfo(song?.spotifyTrack ?? "", accessToken);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (song) {
      setEditorContent(song.content);
    }
  }, [song]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  if (!song) return <p>Song not found</p>;

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      <div className="sticky">
        <div onClick={() => setEditMode(!editMode)}>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {editMode && "Editing: "}
            {song.title}
          </h1>
          <p className="text-gray-700 dark:text-gray-300">{song.artist}</p>
        </div>
        <SpotifyPlayer trackId={song.spotifyTrack} folded={!editMode} />
        {editMode && (
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => setSearchOpen(true)}>
              Link Spotify Track
            </Button>
            <Button
              variant="primary"
              onClick={() => saveSongMeta(trackInfo?.title, trackInfo?.artists)}
            >
              Use Track Info
            </Button>
            <Button variant="primary" onClick={() => saveContent(editorContent)}>
              Save
            </Button>
            <Button variant="primary" onClick={() => setConfirmDeleteOpen(true)}>
              Delete
            </Button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto border rounded">
        <Editor content={song?.content ?? ""} onUpdate={() => {}} />
      </div>

      {searchOpen && <SpotifySearch onClose={() => setSearchOpen(false)} />}
      {confirmDeleteOpen && <ConfirmDeleteDialog onClose={() => setConfirmDeleteOpen(false)} />}
    </div>
  );
}
