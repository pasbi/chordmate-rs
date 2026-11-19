import { type ReactNode, useEffect, useRef, useState } from "react";
import { useBlocker, useParams } from "react-router-dom";
import Editor from "../components/Editor";
import SpotifyPlayer from "./SpotifyPlayer";
import useSong from "../hooks/useSong";
import { useBookmarks } from "../hooks/useBookmarks";
import { useAccessToken } from "../hooks/useAccessToken";
import SpotifySearch from "./SpotifySearch.tsx";
import Button from "./Button.tsx";
import type Song from "../types/Song.ts";
import { songLabel } from "../types/Song.ts";
import type { SpotifyTrack } from "../types/SpotifyTrack.ts";
import { Modal } from "./Modal.tsx";
import { Metronome, type MetronomeHandle } from "./Metronome.tsx";
import { useKeepScreenOn } from "../hooks/useKeepScreenOn";
import { useFullscreen } from "../hooks/useFullscreen";
import { Popover } from "./Popover.tsx";
import { NavBarPortal } from "./NavBarPortal.tsx";
import { usePlayerVolume } from "../hooks/usePlayerVolume";
import { usePlaybackDevice } from "../hooks/usePlaybackDevice";
import { usePlayback } from "../hooks/usePlayback";
import { useTrackAvailability } from "../hooks/useTrackAvailability";
import { PlaybackDevicePicker } from "./PlaybackDevicePicker.tsx";
import {
  MAX_SHEET_FONT_SIZE,
  MIN_SHEET_FONT_SIZE,
  useSheetFontSize,
} from "../hooks/useSheetFontSize";

/** The most semitones chords can be shifted by, either way (the database allows the same). */
const MAX_TRANSPOSE = 11;

/** Shifts the sheet's chords by semitones, e.g. to match the recording. Saved with the song. */
function TransposeControl({
  transpose,
  onChange,
}: {
  transpose: number;
  onChange: (transpose: number) => Promise<void>;
}) {
  const change = (newTranspose: number) =>
    onChange(newTranspose).catch((err: unknown) => {
      console.error(err);
      window.alert("Saving the transposition failed.");
    });
  const shown = transpose === 0 ? "±0" : transpose > 0 ? `+${transpose}` : `−${-transpose}`;
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        title="Transpose down a semitone"
        disabled={transpose <= -MAX_TRANSPOSE}
        onClick={() => void change(transpose - 1)}
      >
        −
      </Button>
      <span
        className="min-w-[4.5ch] shrink-0 text-center tabular-nums"
        title="Transposed by semitones"
      >
        ♯♭ {shown}
      </span>
      <Button
        variant="secondary"
        title="Transpose up a semitone"
        disabled={transpose >= MAX_TRANSPOSE}
        onClick={() => void change(transpose + 1)}
      >
        +
      </Button>
    </div>
  );
}

function PencilIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M11.7 1.3a1 1 0 0 1 1.4 0l1.6 1.6a1 1 0 0 1 0 1.4l-8.4 8.4-3.6 1.1 1.1-3.6z" />
    </svg>
  );
}

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
  const { song, loading, error, saveContent, saveTrack, saveSongMeta, saveTranspose } = useSong(id);
  const bookmarks = useBookmarks(id, song?.spotifyTrack ?? "");
  // null while the sheet has not been edited since the last save.
  const [editedContent, setEditedContent] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const { volume, setVolume } = usePlayerVolume();
  const { fontSize, setFontSize } = useSheetFontSize();
  const fullscreen = useFullscreen();
  const { accessToken, status: accessTokenStatus } = useAccessToken();
  const playbackDevice = usePlaybackDevice(accessToken);
  const trackAvailability = useTrackAvailability(
    accessToken,
    song?.spotifyTrack ? `spotify:track:${song.spotifyTrack}` : null
  );
  const { playback, error: playerError } = usePlayback(
    accessToken,
    playbackDevice.targetName !== null,
    playbackDevice.targetDeviceId
  );
  const [editMode, setEditMode] = useState(false);
  const hasUnsavedChanges = editedContent !== null && editedContent !== song?.content;
  useWarnBeforeUnload(hasUnsavedChanges);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
  );
  useKeepScreenOn(true);

  const metronomeRef = useRef<MetronomeHandle>(null);
  useEffect(() => {
    metronomeRef?.current?.setBpm(song?.bpm ?? 120);
  }, [song]);

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

  const currentBpm = () => metronomeRef.current?.getBpm() ?? song.bpm;

  /** Saves the edited sheet and a changed BPM. Returns whether saving succeeded. */
  const saveEdits = async () => {
    try {
      if (editedContent !== null && hasUnsavedChanges) {
        await saveContent(editedContent);
      }
      const bpm = currentBpm();
      if (bpm !== song.bpm) {
        await saveSongMeta(song.title, [song.artist], song.albumArtUrl, bpm);
      }
      setEditedContent(null);
      return true;
    } catch (err) {
      console.error(err);
      window.alert("Saving the song failed. Your changes are still in the editor.");
      return false;
    }
  };

  const finishEditing = async () => {
    if (await saveEdits()) {
      setEditMode(false);
    }
  };

  const saveAndLeave = async () => {
    if (await saveEdits()) {
      blocker.proceed?.();
    }
  };

  /** Links the track and takes over its title, artists and album art. */
  const selectTrack = async (track: SpotifyTrack) => {
    await saveTrack(track.id);
    await saveSongMeta(track.name, track.artists, track.albumArt ?? null, currentBpm());
  };

  const albumArtUrl = song.albumArtUrl;

  const volumePopover = (
    <Popover
      label="Playback device and volume"
      renderTrigger={(toggle, open) => (
        <Button
          variant="secondary"
          size="icon"
          title="Playback device and volume"
          aria-expanded={open}
          onClick={() => {
            if (!open) {
              void playbackDevice.refreshDevices();
            }
            toggle();
          }}
        >
          🔊
        </Button>
      )}
    >
      <PlaybackDevicePicker
        devices={playbackDevice.devices}
        targetName={playbackDevice.targetName}
        onSelect={playbackDevice.setTargetName}
        onRefresh={() => void playbackDevice.refreshDevices()}
      />
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
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
      label="Display"
      renderTrigger={(toggle, open) => (
        <Button
          variant="secondary"
          size="icon"
          title="Font size, transpose and fullscreen"
          aria-expanded={open}
          onClick={toggle}
        >
          Aa
        </Button>
      )}
    >
      <div className="flex flex-col gap-2">
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
        {song && <TransposeControl transpose={song.transpose} onChange={saveTranspose} />}
        {fullscreen.supported && (
          <Button variant="secondary" aria-pressed={fullscreen.active} onClick={fullscreen.toggle}>
            {fullscreen.active ? "Exit fullscreen" : "Fullscreen"}
          </Button>
        )}
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

  const songTitle = (titleSuffix: ReactNode) => (
    <span className="block leading-tight">
      <span className="flex items-center gap-1">
        <span className="font-semibold truncate">{song.title || "Untitled"}</span>
        {titleSuffix}
      </span>
      <span className="block text-xs truncate text-gray-600 dark:text-gray-400">{song.artist}</span>
    </span>
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
      {editMode ? (
        // In edit mode, title and artist link a different Spotify track; there is no room for a
        // separate button in the bar.
        <button
          type="button"
          title="Change Spotify track"
          onClick={() => setSearchOpen(true)}
          className="flex-1 min-w-0 text-left rounded px-1 -mx-1 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          {songTitle(
            <PencilIcon className="w-3.5 h-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
          )}
        </button>
      ) : (
        <div className="flex-1 min-w-0">{songTitle(null)}</div>
      )}
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

  return (
    <div className="flex flex-col h-full">
      {toolbar}
      <div className="shrink-0 flex flex-col gap-2 px-2 py-1.5 md:px-4 border-b border-gray-200 dark:border-gray-700">
        <SpotifyPlayer
          trackId={song.spotifyTrack}
          replacementTrackUri={trackAvailability.replacementUri}
          trackPlayable={trackAvailability.playable}
          bookmarks={bookmarks}
          enableShortcuts={!editMode}
          volume={volume}
          playback={playback}
          accessTokenStatus={accessTokenStatus}
          unavailableDeviceName={playbackDevice.targetMissing ? playbackDevice.targetName : null}
          playerError={playerError}
        />
      </div>
      <div className="flex-1 min-h-0 p-1 md:p-3">
        <Editor
          key={song.id}
          content={song.content}
          onUpdate={setEditedContent}
          editable={editMode}
          fontSize={fontSize}
          transpose={song.transpose}
        />
      </div>

      {searchOpen && (
        <SpotifySearch
          initialQuery={songLabel(song)}
          onSelect={selectTrack}
          onClose={() => setSearchOpen(false)}
        />
      )}
      {blocker.state === "blocked" && (
        <Modal label="Unsaved changes" onClose={() => blocker.reset()}>
          <div className="p-4 flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Save your changes?</h2>
            <p className="text-gray-700 dark:text-gray-300">
              You are leaving “{song.title || "Untitled"}” with unsaved changes to the sheet.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => blocker.reset()}>
                Keep editing
              </Button>
              <Button variant="danger" onClick={() => blocker.proceed()}>
                Discard
              </Button>
              <Button variant="success" onClick={saveAndLeave}>
                Save
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
