import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Editor from "../components/Editor";
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
import { Popover } from "./Popover.tsx";
import { NavBarPortal } from "./NavBarPortal.tsx";
import { usePlayerVolume } from "../hooks/usePlayerVolume";
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
  const { volume, setVolume } = usePlayerVolume();
  const { fontSize, setFontSize } = useSheetFontSize();
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

  const volumePopover = (
    <Popover
      label="Volume"
      renderTrigger={(toggle, open) => (
        <Button
          variant="secondary"
          size="icon"
          title="Volume"
          aria-expanded={open}
          onClick={toggle}
        >
          🔊
        </Button>
      )}
    >
      <div className="flex items-center gap-2">
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          aria-label="Volume"
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-40"
        />
        <span className="min-w-[4.5ch] shrink-0 text-right text-sm tabular-nums">{volume}%</span>
      </div>
    </Popover>
  );

  const fontSizePopover = (
    <Popover
      label="Font size"
      renderTrigger={(toggle, open) => (
        <Button
          variant="secondary"
          size="icon"
          title="Font size"
          aria-expanded={open}
          onClick={toggle}
        >
          Aa
        </Button>
      )}
    >
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          title="Smaller"
          disabled={fontSize <= MIN_SHEET_FONT_SIZE}
          onClick={() => setFontSize(fontSize - 1)}
        >
          −
        </Button>
        <span className="min-w-[4.5ch] shrink-0 text-center tabular-nums">{fontSize}px</span>
        <Button
          variant="secondary"
          title="Larger"
          disabled={fontSize >= MAX_SHEET_FONT_SIZE}
          onClick={() => setFontSize(fontSize + 1)}
        >
          +
        </Button>
      </div>
    </Popover>
  );

  // The metronome stays mounted while the popover is closed: it keeps running, and the BPM
  // is read from and written to it.
  const metronomePopover = (
    <Popover
      label="Metronome"
      renderTrigger={(toggle, open) => (
        <Button
          variant="secondary"
          size="icon"
          title="Metronome"
          aria-expanded={open}
          onClick={toggle}
        >
          ♩
        </Button>
      )}
    >
      <Metronome ref={metronomeRef} />
    </Popover>
  );

  // Lives in the navigation bar to save vertical space; the popovers open below the bar.
  const toolbar = (
    <NavBarPortal>
      {albumArtUrl && (
        // Hidden on phones, where the title needs the space.
        <img
          className="hidden sm:block w-9 h-9 rounded object-cover shrink-0"
          src={albumArtUrl}
          alt="Album art"
        />
      )}
      <div className="flex-1 min-w-0 leading-tight">
        <h1 className="font-semibold truncate">
          {editMode && "Editing: "}
          {song.title || "Untitled"}
        </h1>
        <p className="text-xs truncate text-gray-600 dark:text-gray-400">{song.artist}</p>
      </div>
      {volumePopover}
      {fontSizePopover}
      {metronomePopover}
      {editMode ? (
        <Button variant="success" onClick={finishEditing}>
          {hasUnsavedChanges ? "Save" : "Done"}
        </Button>
      ) : (
        <Button variant="primary" onClick={() => setEditMode(true)}>
          Edit
        </Button>
      )}
    </NavBarPortal>
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
      {toolbar}
      <div className="shrink-0 flex flex-col gap-2 px-2 py-1.5 md:px-4 border-b border-gray-200 dark:border-gray-700">
        <SpotifyPlayer trackId={song.spotifyTrack} enableShortcuts={!editMode} volume={volume} />
        {editActions}
      </div>
      <div className="flex-1 min-h-0 p-1 md:p-3">
        <Editor
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
