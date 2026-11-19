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
import { wrapTranspose } from "../lib/transpose.ts";
import { isSaveShortcut } from "../lib/isTypingTarget.ts";
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

function formatTranspose(transpose: number) {
  return transpose === 0 ? "±0" : transpose > 0 ? `+${transpose}` : `−${-transpose}`;
}

/** A group of the song menu's rows, set off from the next by a line. */
function MenuSection({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 py-3 first:pt-1 last:pb-1">{children}</div>;
}

/**
 * A row of the song menu: an icon naming it (spelled out in its title), its controls, and an
 * optional button at its end. The icons share a narrow column, so that the controls line up.
 */
function MenuRow({
  icon,
  title,
  trailing,
  children,
}: {
  /** null for a row continuing the one above. */
  icon: ReactNode;
  title: string;
  trailing: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-2" title={title}>
      <span
        className="self-start min-h-10 flex items-center justify-center text-gray-600 dark:text-gray-300 select-none"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="flex items-center gap-2 min-w-0" role="group" aria-label={title}>
        {children}
      </div>
      <div className="self-start">{trailing}</div>
    </div>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M2 6h3l4-3.5v11L5 10H2z" />
      <path
        d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.5a6 6 0 0 1 0 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A square button showing only an icon; its title says what it does. */
function IconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button variant="secondary" size="icon" title={title} aria-label={title} onClick={onClick}>
      {children}
    </Button>
  );
}

function RefreshIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2v3.5H10" />
    </svg>
  );
}

/** Corners pointing out, or in to leave fullscreen. */
function FullscreenIcon({ exit }: { exit: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d={
          exit ? "M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4" : "M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"
        }
      />
    </svg>
  );
}

/** − value +, across the row, for values changed in steps. Quick taps must neither zoom nor select text. */
function StepControl({
  value,
  valueTitle,
  decreaseTitle,
  increaseTitle,
  canDecrease,
  canIncrease,
  onStep,
}: {
  value: string;
  valueTitle: string;
  decreaseTitle: string;
  increaseTitle: string;
  canDecrease: boolean;
  canIncrease: boolean;
  onStep: (step: -1 | 1) => void;
}) {
  return (
    <div className="flex flex-1 items-center gap-2 select-none">
      <Button
        variant="secondary"
        className="flex-1"
        title={decreaseTitle}
        disabled={!canDecrease}
        onClick={() => onStep(-1)}
      >
        −
      </Button>
      <span className="w-14 shrink-0 text-center tabular-nums" title={valueTitle}>
        {value}
      </span>
      <Button
        variant="secondary"
        className="flex-1"
        title={increaseTitle}
        disabled={!canIncrease}
        onClick={() => onStep(1)}
      >
        +
      </Button>
    </div>
  );
}

/** Shifts the sheet's chords by semitones, e.g. to match the recording. Saved with the song. */
function TransposeControl({
  transpose,
  onChange,
}: {
  transpose: number;
  onChange: (transpose: number) => Promise<void>;
}) {
  const step = (semitones: -1 | 1) =>
    onChange(wrapTranspose(transpose + semitones)).catch((err: unknown) => {
      console.error(err);
      window.alert("Saving the transposition failed.");
    });
  return (
    <StepControl
      value={formatTranspose(wrapTranspose(transpose))}
      valueTitle="Semitones"
      decreaseTitle="Transpose down a semitone"
      increaseTitle="Transpose up a semitone"
      canDecrease={true}
      canIncrease={true}
      onStep={(semitones) => void step(semitones)}
    />
  );
}

/** While mounted (in edit mode), Ctrl+S saves and finishes editing, like Done. */
function SaveShortcut({ onSave }: { onSave: () => Promise<void> }) {
  const latestOnSave = useRef(onSave);
  useEffect(() => {
    latestOnSave.current = onSave;
  });
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isSaveShortcut(event)) {
        event.preventDefault();
        void latestOnSave.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return null;
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

  // Everything but playing and the sheet itself lives in one menu, so that the title bar keeps
  // room for the title. The metronome stays mounted while the menu is closed: it keeps running,
  // and the BPM is read from and written to it.
  const menu = (
    <Popover
      label="Song menu"
      renderTrigger={(toggle, open) => (
        <Button
          variant="secondary"
          size="icon"
          title="Menu"
          aria-expanded={open}
          onClick={() => {
            if (!open) {
              void playbackDevice.refreshDevices();
            }
            toggle();
          }}
        >
          ☰
        </Button>
      )}
    >
      {(close) => (
        <div className="w-80 max-w-[calc(100vw-2rem)] flex flex-col divide-y divide-gray-200 dark:divide-gray-700">
          {/* Actions first, apart from the settings below. */}
          <MenuSection>
            <div className="flex gap-2">
              {fullscreen.supported && (
                <Button variant="secondary" className="flex-1 gap-2" onClick={fullscreen.toggle}>
                  <FullscreenIcon exit={fullscreen.active} />
                  {fullscreen.active ? "Exit fullscreen" : "Fullscreen"}
                </Button>
              )}
              {!editMode && (
                <Button
                  variant="secondary"
                  className="flex-1 gap-2"
                  onClick={() => {
                    close();
                    setEditMode(true);
                  }}
                >
                  <PencilIcon className="w-4 h-4" />
                  Edit
                </Button>
              )}
            </div>
          </MenuSection>
          <MenuSection>
            <MenuRow
              icon={<SpeakerIcon />}
              title="Play on"
              trailing={
                <IconButton
                  title="Refresh the device list"
                  onClick={() => void playbackDevice.refreshDevices()}
                >
                  <RefreshIcon />
                </IconButton>
              }
            >
              <PlaybackDevicePicker
                devices={playbackDevice.devices}
                targetName={playbackDevice.targetName}
                onSelect={playbackDevice.setTargetName}
              />
            </MenuRow>
            <MenuRow icon={null} title="Volume" trailing={null}>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                aria-label="Volume"
                onChange={(e) => setVolume(Number(e.target.value))}
                className="flex-1 min-w-0"
              />
              <span className="min-w-[4.5ch] shrink-0 text-right text-sm tabular-nums select-none">
                {volume}%
              </span>
            </MenuRow>
          </MenuSection>
          <MenuSection>
            <MenuRow
              icon={<span className="font-semibold">Aa</span>}
              title="Font size"
              trailing={null}
            >
              <StepControl
                value={`${fontSize}px`}
                valueTitle="Font size"
                decreaseTitle="Smaller"
                increaseTitle="Larger"
                canDecrease={fontSize > MIN_SHEET_FONT_SIZE}
                canIncrease={fontSize < MAX_SHEET_FONT_SIZE}
                onStep={(step) => setFontSize(fontSize + step)}
              />
            </MenuRow>
            <MenuRow
              icon={<span className="font-semibold">♯♭</span>}
              title="Transpose"
              trailing={null}
            >
              <TransposeControl transpose={song.transpose} onChange={saveTranspose} />
            </MenuRow>
          </MenuSection>
          <MenuSection>
            <MenuRow icon={<span className="text-xl">♩</span>} title="Metronome" trailing={null}>
              <Metronome ref={metronomeRef} />
            </MenuRow>
          </MenuSection>
        </div>
      )}
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
      {editMode && <SaveShortcut onSave={finishEditing} />}
      {editMode && (
        <Button variant="success" title="Save and finish editing (Ctrl+S)" onClick={finishEditing}>
          {hasUnsavedChanges ? "Save" : "Done"}
        </Button>
      )}
      {menu}
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
          // The Spotify search has the keyboard while it is open (e.g. right after an import).
          focusAtStart={editMode && !searchOpen}
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
