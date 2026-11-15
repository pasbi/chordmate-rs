import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Editor, { type EditorHandle } from "../components/Editor";
import SpotifyPlayer from "./SpotifyPlayer";
import useSong from "../hooks/useSong";
import useTrackInfo from "../hooks/useTrackInfo";
import { useAccessToken } from "../hooks/useAccessToken";
import SpotifySearch from "./SpotifySearch.tsx";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog.tsx";
import Button from "./Button.tsx";
import type Song from "../types/Song.ts";
import { Metronome, type MetronomeHandle } from "./Metronome.tsx";
import { useKeepScreenOn } from "../hooks/useKeepScreenOn";
import {
  MAX_SHEET_FONT_SIZE,
  MIN_SHEET_FONT_SIZE,
  useSheetFontSize,
} from "../hooks/useSheetFontSize";

function isNewSong(song?: Song) {
  if (!song) {
    return false;
  }
  const hasLabel = ((song?.artist ?? "") + (song?.title ?? "")).trim().length > 0;
  const hasSpotifyTrack = (song?.spotifyTrack?.length ?? 0) > 0;
  return !hasLabel || !hasSpotifyTrack;
}

/** Asks the browser to confirm before closing or reloading the page while `active`. */
function useWarnBeforeUnload(active: boolean) {
  useEffect(() => {
    if (!active) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);
}

export default function SongDetail() {
  const { id: idString } = useParams<{ id: string }>();
  const id = parseInt(idString!);
  const { song, loading, error, saveContent, saveSongMeta } = useSong(id);
  // null while the sheet has not been edited since the last save.
  const [editedContent, setEditedContent] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [metronomeOpen, setMetronomeOpen] = useState(false);
  const [fontSizeOpen, setFontSizeOpen] = useState(false);
  const { fontSize, setFontSize } = useSheetFontSize();
  const editorRef = useRef<EditorHandle>(null);
  const { accessToken } = useAccessToken();
  const trackInfo = useTrackInfo(song?.spotifyTrack ?? "", accessToken);
  const [editMode, setEditMode] = useState(false);
  const hasUnsavedChanges = editedContent !== null && editedContent !== song?.content;
  useWarnBeforeUnload(hasUnsavedChanges);
  useKeepScreenOn(true);

  const metronomeRef = useRef<MetronomeHandle>(null);
  useEffect(() => {
    metronomeRef?.current?.setBpm(song?.bpm ?? 120);
  }, [song]);

  const saveCurrentTrackMeta = useCallback(() => {
    saveSongMeta(
      trackInfo?.title ?? null,
      trackInfo?.artists ?? null,
      trackInfo?.albumArtUrl ?? null,
      metronomeRef?.current?.getBpm() ?? null
    );
  }, [trackInfo, saveSongMeta]);

  // Decide on edit mode once per song, not on every refetch: saving refetches the song,
  // and that must not end editing.
  const initializedSongId = useRef<number | null>(null);
  useEffect(() => {
    if (!song || initializedSongId.current === song.id) {
      return;
    }
    initializedSongId.current = song.id;
    const isNew = isNewSong(song);
    queueMicrotask(() => {
      setSearchOpen(isNew);
      setEditMode(isNew);
    });
  }, [song]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  if (!song) return <p>Song not found</p>;

  const finishEditing = async () => {
    if (editedContent !== null && hasUnsavedChanges) {
      try {
        await saveContent(editedContent);
      } catch (err) {
        console.error(err);
        window.alert("Saving the song failed. Your changes are still in the editor.");
        return;
      }
    }
    setEditedContent(null);
    setEditMode(false);
  };

  const onCloseSearch = () => {
    setSearchOpen(false);
    if (isNewSong(song)) {
      saveCurrentTrackMeta();
    }
  };

  const albumArtUrl = song.albumArtUrl ?? trackInfo?.albumArtUrl;

  const header = (
    <div className="flex items-center gap-2 sm:gap-3">
      {albumArtUrl && (
        <img
          className="w-10 h-10 sm:w-14 sm:h-14 rounded object-cover shrink-0"
          src={albumArtUrl}
          alt="Album art"
        />
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg sm:text-xl font-bold truncate text-gray-900 dark:text-gray-100">
          {editMode && "Editing: "}
          {song.title || "Untitled"}
        </h1>
        <p className="truncate text-gray-700 dark:text-gray-300">{song.artist}</p>
      </div>
      <Button
        variant="secondary"
        title="Font size"
        aria-pressed={fontSizeOpen}
        onClick={() => setFontSizeOpen(!fontSizeOpen)}
      >
        Aa
      </Button>
      <Button
        variant="secondary"
        title="Metronome"
        aria-pressed={metronomeOpen}
        onClick={() => setMetronomeOpen(!metronomeOpen)}
      >
        ♩
      </Button>
      {editMode ? (
        <Button variant="success" onClick={finishEditing}>
          {hasUnsavedChanges ? "Save & close" : "Done"}
        </Button>
      ) : (
        <Button variant="primary" onClick={() => setEditMode(true)}>
          Edit
        </Button>
      )}
    </div>
  );

  const fitFontSize = () => {
    const fitting = editorRef.current?.fittingFontSize();
    if (fitting) {
      setFontSize(Math.floor(fitting));
    }
  };

  const fontSizeControls = fontSizeOpen && (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        title="Smaller"
        disabled={fontSize <= MIN_SHEET_FONT_SIZE}
        onClick={() => setFontSize(fontSize - 1)}
      >
        A−
      </Button>
      <span className="w-12 text-center tabular-nums">{fontSize}px</span>
      <Button
        variant="secondary"
        title="Larger"
        disabled={fontSize >= MAX_SHEET_FONT_SIZE}
        onClick={() => setFontSize(fontSize + 1)}
      >
        A+
      </Button>
      <Button
        variant="secondary"
        title="Largest size at which the longest line fits the width"
        onClick={fitFontSize}
      >
        Fit width
      </Button>
    </div>
  );

  const editActions = editMode && (
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" onClick={() => setSearchOpen(true)}>
        Link Spotify Track
      </Button>
      <Button variant="primary" onClick={saveCurrentTrackMeta}>
        Use Track Info
      </Button>
      <Button variant="danger" onClick={() => setConfirmDeleteOpen(true)}>
        Delete
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 flex flex-col gap-2 p-2 md:p-4 border-b border-gray-200 dark:border-gray-700">
        {header}
        <SpotifyPlayer trackId={song.spotifyTrack} enableShortcuts={!editMode} />
        {/* Kept mounted while hidden: the BPM is read from and written to it. */}
        <div className={metronomeOpen ? "" : "hidden"}>
          <Metronome ref={metronomeRef} />
        </div>
        {fontSizeControls}
        {editActions}
      </div>
      <div className="flex-1 min-h-0 p-2 md:p-4">
        <Editor
          ref={editorRef}
          content={song.content}
          onUpdate={setEditedContent}
          editable={editMode}
          fontSize={fontSize}
        />
      </div>

      {searchOpen && <SpotifySearch onClose={onCloseSearch} />}
      {confirmDeleteOpen && <ConfirmDeleteDialog onClose={() => setConfirmDeleteOpen(false)} />}
    </div>
  );
}
