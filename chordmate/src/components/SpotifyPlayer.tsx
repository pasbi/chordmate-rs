import type { AccessTokenStatus } from "../hooks/useAccessToken";
import type { Playback } from "../hooks/usePlayback";
import { describeSpotifyFailure, type PlaybackState, playsTrack } from "../lib/spotifyApi";
import { latestOnly } from "../lib/latestOnly";
import type { Bookmarks } from "../hooks/useBookmarks";
import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { isTypingTarget } from "../lib/isTypingTarget";
import { formatTime, type Milliseconds, type Seconds } from "../lib/time";
import type Bookmark from "../types/Bookmark";
import { BookmarkControls } from "./BookmarkControls";
import { BookmarkMarkers } from "./BookmarkMarkers";
import type { BookmarkOverlay } from "./bookmarkUi";
import { ControlButton } from "./ControlButton";

function trackIdToUri(trackId: string) {
  return `spotify:track:${trackId}`;
}

/** How long a failed command's explanation stays in the status line. */
const FAILURE_SHOWN_MS = 8000;

function statusMessage(
  accessTokenStatus: AccessTokenStatus,
  deviceProblem: string | null,
  trackPlayable: boolean,
  playerError: string | null,
  /** Why the last command (play, seek, …) failed, for a while after it did. */
  failure: string | null,
  /** Why the playback state can't be read, while it can't. */
  pollFailure: string | null,
  /** What playback waits for before it can start, while it waits. */
  waitingFor: string | null
): string | null {
  switch (accessTokenStatus) {
    case "waitingForLogin":
      return "Not connected to Spotify. Log in on the machine running the Chordmate server; playback starts here automatically.";
    case "serverUnreachable":
      return "Cannot reach the Chordmate server. Retrying…";
    case "loading":
      return null;
    case "ready":
      if (deviceProblem !== null) {
        return deviceProblem;
      }
      if (!trackPlayable) {
        return "This track isn't available on Spotify in your country. Link another version: Edit, then tap the title.";
      }
      if (playerError !== null) {
        return playerError;
      }
      return failure ?? pollFailure ?? waitingFor;
  }
}

/** Maps the linear slider value (0–100) to a perceptually more even volume (0–1). */
function sliderToVolume(sliderValue: number) {
  const steepness = 2;
  return (Math.exp((steepness * sliderValue) / 100) - 1) / (Math.exp(steepness) - 1);
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M4 2.5v11l9.5-5.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" />
    </svg>
  );
}

/** How long before a song's end playback is stopped, so that the next track doesn't start. */
const END_MARGIN_MS = 500;
/** When the song played this close to its end, another track starting is the album playing on. */
const END_WINDOW_MS = 5000;
/** A position reported just before a loop's start still counts as in the loop (seek rounding). */
const LOOP_START_TOLERANCE_MS = 250;
const SLIDER_SEEK_DELAY_MS = 300;
const DISPLAY_TICK_MS = 250;

/** A polled playback state and when it was taken, to move the position on between polls. */
type Sample = { state: PlaybackState | null; takenAt: number };

/** Whether this song's track is in the player: not at all, paused, or playing. */
export type TrackState = "unloaded" | "paused" | "playing";

/** What the song page reads from the player: its current position, and a jump. */
export interface PlayerHandle {
  /** The position as of now; null while this song's track isn't loaded. */
  now: () => { positionMs: number; durationMs: number } | null;
  /** Moves to a position in this song's track and plays. */
  jumpTo: (positionMs: number) => void;
}

/** Marks the passage of a loop on the slider's bar (see .position-slider in main.css). */
function loopBandStyle(
  startMs: number | null,
  endMs: number | null,
  durationMs: number
): CSSProperties | undefined {
  if (startMs === null || endMs === null || durationMs <= 0) {
    return undefined;
  }
  // As the markers: the thumb's center stays half a thumb (8 px) from the slider's ends.
  const offset = (positionMs: number) =>
    `calc(8px + (100% - 16px) * ${Math.min(positionMs / durationMs, 1)})`;
  return {
    "--loop-start": offset(startMs),
    "--loop-end": offset(endMs),
  } as CSSProperties;
}

export default function SpotifyPlayer({
  trackId,
  replacementTrackUri,
  trackPlayable,
  bookmarks,
  enableShortcuts,
  volume,
  playback,
  accessTokenStatus,
  deviceProblem,
  playerError,
  handleRef,
  onTrackStateChange,
  targetDeviceName,
}: {
  trackId: string;
  /** The track Spotify plays instead of `trackId`'s if that one was withdrawn, else null. */
  replacementTrackUri: string | null;
  /** False if the linked track can't be played in the user's country at all. */
  trackPlayable: boolean;
  /** The bookmarks of the song in this track. */
  bookmarks: Bookmarks;
  enableShortcuts: boolean;
  /** Linear slider value, 0–100. */
  volume: number;
  /** Null while no device is ready to play. */
  playback: Playback | null;
  accessTokenStatus: AccessTokenStatus;
  /** Why the chosen output device can't play (e.g. it isn't available), if it can't. */
  deviceProblem: string | null;
  /** Why this browser's player can't start, if it can't. */
  playerError: string | null;
  /** Filled with the player's current position and a jump, for the sheet (auto-scroll). */
  handleRef: RefObject<PlayerHandle | null>;
  /** Called when this song's track is loaded, starts or stops playing, or is gone. */
  onTrackStateChange: (trackState: TrackState) => void;
  /** The device chosen to play on, null for this browser. */
  targetDeviceName: string | null;
}) {
  // Failures are shown, not only logged: on a tablet, nobody sees the console.
  const [failure, setFailure] = useState<string | null>(null);
  const failureTimeout = useRef<number | null>(null);
  const reportFailure = useCallback(
    (action: string) => (err: unknown) => {
      console.error(err);
      setFailure(`${action} failed: ${describeSpotifyFailure(err)}.`);
      if (failureTimeout.current !== null) {
        clearTimeout(failureTimeout.current);
      }
      failureTimeout.current = window.setTimeout(() => {
        failureTimeout.current = null;
        setFailure(null);
      }, FAILURE_SHOWN_MS);
    },
    []
  );
  useEffect(
    () => () => {
      if (failureTimeout.current !== null) {
        clearTimeout(failureTimeout.current);
      }
    },
    []
  );
  const [pollFailure, setPollFailure] = useState<string | null>(null);
  const waitingFor =
    playback !== null
      ? null
      : targetDeviceName === null
        ? "Starting Spotify's player in this browser…"
        : `Connecting to “${targetDeviceName}”…`;
  const message = statusMessage(
    accessTokenStatus,
    deviceProblem,
    trackPlayable,
    playerError,
    failure,
    playback === null ? null : pollFailure,
    waitingFor
  );
  const trackUri = trackIdToUri(trackId);

  const [sample, setSample] = useState<Sample>({ state: null, takenAt: 0 });
  const refresh = useCallback(async () => {
    if (!playback) {
      return;
    }
    const state = await playback.currentState();
    setSample({ state, takenAt: performance.now() });
  }, [playback]);

  useEffect(() => {
    if (!playback) {
      return;
    }
    const poll = () =>
      refresh()
        .then(() => setPollFailure(null))
        .catch((err: unknown) => {
          console.error(err);
          setPollFailure(`Can't read what Spotify plays: ${describeSpotifyFailure(err)}.`);
        });
    poll();
    const interval = setInterval(poll, playback.pollIntervalMs);
    return () => clearInterval(interval);
  }, [playback, refresh]);

  // This song's state; null while the device has another track loaded (e.g. after linking a
  // new track, or when something else was started there).
  // Same check as playsTrack(), written out: passing `sample.state` to an imported function
  // during render makes the React Compiler assume it gets mutated and skip this component.
  const playsThisTrack =
    sample.state?.trackUri === trackUri ||
    (replacementTrackUri !== null && sample.state?.trackUri === replacementTrackUri) ||
    sample.state?.linkedFromUri === trackUri;
  const state = playsThisTrack ? sample.state : null;
  // The button acts on whatever the device plays: a different song must be pausable here, too.
  const playingAnything = sample.state !== null && !sample.state.paused;
  const paused = !playingAnything;
  const otherTrackPlaying =
    playingAnything && state === null ? (sample.state?.trackName ?? "another song") : null;

  // Closing the song (navigating away, closing or reloading the page) pauses it, also on another
  // device. Something else playing there, started elsewhere, is left alone.
  const latest = useRef({ playback, playingThisSong: false });
  useEffect(() => {
    latest.current = { playback, playingThisSong: state !== null && !state.paused };
  });
  useEffect(() => {
    const pauseThisSong = () => {
      const { playback: current, playingThisSong } = latest.current;
      if (current && playingThisSong) {
        current.pause().catch(console.error);
      }
    };
    window.addEventListener("pagehide", pauseThisSong);
    return () => {
      window.removeEventListener("pagehide", pauseThisSong);
      pauseThisSong();
    };
  }, []);

  // Between polls, a playing track's position moves on with the clock.
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (paused) {
      return;
    }
    const interval = setInterval(() => setNow(performance.now()), DISPLAY_TICK_MS);
    return () => clearInterval(interval);
  }, [paused]);

  // While the user drags the slider, it shows the dragged position instead of the player's.
  const [scrubPosition, setScrubPosition] = useState<number | null>(null);
  const duration = state?.duration ?? 0;
  const playedSincePoll = paused ? 0 : Math.max(0, now - sample.takenAt);
  const position = scrubPosition ?? Math.min((state?.position ?? 0) + playedSincePoll, duration);

  const sliderSeekTimeout = useRef<number | null>(null);
  const handleSliderChange = (newPosition: number) => {
    setScrubPosition(newPosition);
    if (sliderSeekTimeout.current) {
      clearTimeout(sliderSeekTimeout.current);
    }
    sliderSeekTimeout.current = setTimeout(() => {
      if (!playback) {
        setScrubPosition(null);
        return;
      }
      playback
        .seek(newPosition)
        .then(() =>
          setSample((previous) => ({
            state: previous.state && { ...previous.state, position: newPosition },
            takenAt: performance.now(),
          }))
        )
        .catch(reportFailure("Seeking"))
        .finally(() => setScrubPosition(null));
    }, SLIDER_SEEK_DELAY_MS);
  };

  // Applied with a delay, so that dragging the volume slider doesn't flood the device with calls.
  // Another device keeps its own volume until the slider is moved here.
  const volumeDeviceId = useRef<string | null>(null);
  useEffect(() => {
    if (!playback) {
      return;
    }
    const newDevice = volumeDeviceId.current !== playback.deviceId;
    volumeDeviceId.current = playback.deviceId;
    if (newDevice && !playback.restoresVolume) {
      return;
    }
    const timeout = setTimeout(() => {
      playback.setVolume(sliderToVolume(volume)).catch(reportFailure("Setting the volume"));
    }, SLIDER_SEEK_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [playback, volume, reportFailure]);

  // Start playback once, when a device is ready, unless it already plays this track (e.g. the
  // PC plays it and the song was just opened on a tablet).
  const autoplayed = useRef(false);
  useEffect(() => {
    if (!playback || autoplayed.current) {
      return;
    }
    autoplayed.current = true;
    playback
      .currentState()
      .then((current) =>
        playsTrack(current, trackUri, replacementTrackUri) && !current?.paused
          ? undefined
          : playback.play(trackUri, 0)
      )
      .then(refresh)
      .catch(reportFailure("Playing"));
  }, [playback, trackUri, replacementTrackUri, refresh, reportFailure]);

  // Choosing another output device moves the music there, playing if it was playing, so that the
  // controls keep acting on what is heard. Only the first device starts by autoplay instead.
  const wasPlaying = useRef(false);
  useEffect(() => {
    wasPlaying.current = !paused;
  }, [paused]);
  const previousDeviceId = useRef<string | null>(null);
  useEffect(() => {
    if (!playback) {
      return;
    }
    const switched =
      previousDeviceId.current !== null && previousDeviceId.current !== playback.deviceId;
    previousDeviceId.current = playback.deviceId;
    if (switched) {
      playback
        .transferHere(wasPlaying.current)
        .then(refresh)
        .catch(reportFailure("Moving playback"));
    }
  }, [playback, refresh, reportFailure]);

  // Linking another track pauses the old one instead of playing the new one; Play then starts
  // the new track from the beginning. Only if something plays: with nothing loaded (e.g. a new
  // song getting its first track), this browser's player rejects a pause with "no list was
  // loaded", which would show as an error.
  const previousTrackId = useRef(trackId);
  useEffect(() => {
    if (previousTrackId.current === trackId) {
      return;
    }
    previousTrackId.current = trackId;
    if (!playback) {
      return;
    }
    playback
      .currentState()
      .then((current) => (current !== null && !current.paused ? playback.pause() : undefined))
      .catch(console.error);
  }, [playback, trackId]);

  // Where Play was last pressed in this track, the target of ↺ while no bookmark is active.
  // Jumps don't change it, so that repeated jumps keep returning to the same place.
  const [playStart, setPlayStart] = useState({ trackUri, positionMs: 0 });
  const lastPlayStartMs = playStart.trackUri === trackUri ? playStart.positionMs : 0;

  const togglePlay = useCallback(async () => {
    if (!playback) {
      return;
    }
    try {
      if (paused) {
        setPlayStart({ trackUri, positionMs: position });
        await playback.play(trackUri, position);
      } else {
        await playback.pause();
      }
    } catch (err) {
      reportFailure(paused ? "Playing" : "Pausing")(err);
    }
    // Also after a failure, so that the controls show the actual state instead of a stale one.
    await refresh().catch(console.error);
  }, [playback, paused, trackUri, position, refresh, reportFailure]);

  // Seeks run one after another, each relative to the device's actual position at that moment,
  // so that quickly repeated presses add up exactly.
  const seekQueue = useRef(Promise.resolve());
  const seekTo = useCallback(
    (targetOf: (current: PlaybackState) => number) => {
      if (!playback) {
        return;
      }
      seekQueue.current = seekQueue.current
        .then(async () => {
          const current = await playback.currentState();
          if (!current) {
            return;
          }
          const target = Math.min(Math.max(targetOf(current), 0), current.duration);
          await playback.seek(target);
          setSample({ state: { ...current, position: target }, takenAt: performance.now() });
        })
        .catch(reportFailure("Seeking"));
    },
    [playback, reportFailure]
  );
  const seekBy = useCallback(
    (delta: Seconds) => seekTo((current) => current.position + delta * 1000),
    [seekTo]
  );

  // Jumps go to absolute positions, so of quick ones (e.g. shifting a bookmark step by step)
  // only the newest matters: those in between are dropped instead of played one by one.
  const jumpRunner = useRef<ReturnType<typeof latestOnly> | null>(null);

  /** Moves to a position in this song's track and plays, whatever the device did before. */
  const jumpAndPlay = useCallback(
    (positionMs: number) => {
      if (!playback) {
        return;
      }
      jumpRunner.current ??= latestOnly(reportFailure("Jumping"));
      jumpRunner.current(() => {
        // After any seeks still running, which act on the same device.
        const jump = seekQueue.current.then(async () => {
          const current = await playback.currentState();
          if (
            current !== null &&
            playsTrack(current, trackUri, replacementTrackUri) &&
            !current.paused
          ) {
            const target = Math.min(Math.max(positionMs, 0), current.duration);
            await playback.seek(target);
            setSample({ state: { ...current, position: target }, takenAt: performance.now() });
          } else {
            await playback.play(trackUri, Math.max(positionMs, 0));
            await refresh();
          }
        });
        seekQueue.current = jump.catch(() => {});
        return jump;
      });
    },
    [playback, trackUri, replacementTrackUri, refresh, reportFailure]
  );

  /** Moves to a position in this song's track, playing or paused as before. */
  const seekInTrack = useCallback(
    (positionMs: number) => {
      if (!playback) {
        return;
      }
      seekQueue.current = seekQueue.current
        .then(async () => {
          const current = await playback.currentState();
          // Another track loaded on the device must not be moved. This song's track may play
          // under another ID, though: relinked, or replaced in the user's country.
          if (current === null || !playsTrack(current, trackUri, replacementTrackUri)) {
            return;
          }
          const target = Math.min(Math.max(positionMs, 0), current.duration);
          await playback.seek(target);
          setSample({ state: { ...current, position: target }, takenAt: performance.now() });
        })
        .catch(reportFailure("Seeking"));
    },
    [playback, trackUri, replacementTrackUri, reportFailure]
  );

  // Tells the page what its track is doing.
  const trackState: TrackState = state === null ? "unloaded" : state.paused ? "paused" : "playing";
  useEffect(() => {
    onTrackStateChange(trackState);
  }, [trackState, onTrackStateChange]);

  // The position as of now, between polls estimated from the last one, for auto-scrolling the
  // sheet in step with the music; null while this song's track isn't loaded.
  useEffect(() => {
    handleRef.current = {
      now: () => {
        if (state === null || state.duration <= 0) {
          return null;
        }
        const playedSinceSample = state.paused ? 0 : performance.now() - sample.takenAt;
        return {
          positionMs: Math.min(state.position + playedSinceSample, state.duration),
          durationMs: state.duration,
        };
      },
      jumpTo: jumpAndPlay,
    };
  });

  /** Makes a bookmark, or the last play start for null, ↺'s target, and moves there. */
  // A loop can be switched off, to play on past its end into the next section. It is identified
  // by its bookmark and both ends, so that another passage, or a shifted one, loops again.
  const [loopOffKey, setLoopOffKey] = useState<string | null>(null);

  const selectBookmark = (bookmark: Bookmark | null) => {
    // Choosing a bookmark, even the active one again, starts with its loop on.
    setLoopOffKey(null);
    bookmarks.setActiveId(bookmark?.id ?? null);
    seekInTrack(bookmark ? bookmark.positionMs : lastPlayStartMs);
  };

  // A song is started within its album (see startPlaybackInAlbum), so the album would play on
  // after it. Instead, playback stops at the song's end and returns to its start, like a player
  // at the end of a playlist.
  const stopAtEnd = useCallback(() => {
    if (!playback) {
      return;
    }
    playback
      .pause()
      .then(() => seekInTrack(0))
      .catch(reportFailure("Stopping at the song's end"));
  }, [playback, seekInTrack, reportFailure]);

  useEffect(() => {
    // A duration of 0 means not known yet (e.g. right after starting).
    if (state === null || state.paused || state.duration <= 0) {
      return;
    }
    const playedSinceSample = performance.now() - sample.takenAt;
    const untilEnd = state.duration - state.position - playedSinceSample - END_MARGIN_MS;
    const timeout = setTimeout(stopAtEnd, Math.max(untilEnd, 0));
    return () => clearTimeout(timeout);
  }, [state, sample.takenAt, stopAtEnd]);

  // In case the timer came too late (e.g. throttled in the background): when the song was about
  // to end and the next track took over, that track is paused.
  const wasEnding = useRef(false);
  useEffect(() => {
    if (state !== null) {
      wasEnding.current =
        !state.paused && state.duration > 0 && state.duration - state.position < END_WINDOW_MS;
      return;
    }
    if (wasEnding.current && sample.state !== null && !sample.state.paused) {
      wasEnding.current = false;
      playback?.pause().catch(console.error);
    }
  }, [state, sample, playback]);

  // The active bookmark's passage up to its loop end B plays again and again: reaching B returns
  // to the bookmark. Only from within the passage, so that playing the song from elsewhere isn't
  // caught by it before reaching the bookmark.
  const activeBookmark =
    bookmarks.bookmarks.find((bookmark) => bookmark.id === bookmarks.activeId) ?? null;
  const loopStartMs = activeBookmark?.positionMs ?? null;
  const loopEndMs = activeBookmark?.endMs ?? null;
  const loopKey =
    activeBookmark === null || loopEndMs === null
      ? null
      : `${activeBookmark.id}:${loopStartMs}:${loopEndMs}`;
  const loopOn = loopKey !== null && loopOffKey !== loopKey;
  const toggleLoop = () => setLoopOffKey(loopOn ? loopKey : null);
  useEffect(() => {
    if (!loopOn || state === null || state.paused || loopStartMs === null || loopEndMs === null) {
      return;
    }
    const positionNow = state.position + performance.now() - sample.takenAt;
    if (state.position < loopStartMs - LOOP_START_TOLERANCE_MS || positionNow >= loopEndMs) {
      return;
    }
    const timeout = setTimeout(() => seekInTrack(loopStartMs), loopEndMs - positionNow);
    return () => clearTimeout(timeout);
  }, [loopOn, state, sample.takenAt, loopStartMs, loopEndMs, seekInTrack]);

  // The bookmark menu and editor take the keyboard while they are open.
  const [bookmarkOverlay, setBookmarkOverlay] = useState<BookmarkOverlay>(null);

  // Opened from the bookmark menu, the editor appears where a long press on the bookmark's marker
  // opens it: below the slider at the marker (see BookmarkMarkers).
  const sliderRef = useRef<HTMLDivElement>(null);
  const editBookmark = (bookmark: Bookmark) => {
    const slider = sliderRef.current?.getBoundingClientRect();
    if (!slider || duration <= 0) {
      return;
    }
    const fraction = Math.min(bookmark.positionMs / duration, 1);
    const x = slider.left + 8 + (slider.width - 16) * fraction;
    setBookmarkOverlay({ kind: "editor", bookmarkId: bookmark.id, x, y: slider.bottom + 8 });
  };
  const shortcutsActive = enableShortcuts && bookmarkOverlay === null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!shortcutsActive || isTypingTarget(e.target)) {
        return;
      }
      switch (e.key) {
        case " ":
          togglePlay();
          e.preventDefault();
          break;
        case "ArrowRight":
          seekBy((e.ctrlKey ? 10 : 1) as Seconds);
          break;
        case "ArrowLeft":
          seekBy(-(e.ctrlKey ? 10 : 1) as Seconds);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcutsActive, togglePlay, seekBy]);

  // One row, buttons left of the slider. Only when the slider would get narrower than its basis
  // does it wrap onto its own full-width line below the buttons.
  return (
    <div className="flex flex-col gap-1">
      {message && <p className="text-xs text-amber-700 dark:text-amber-400">{message}</p>}
      {otherTrackPlaying && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Now playing “{otherTrackPlaying}”, not this song. Pause it, then play to start this one.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <div className="flex flex-1 basis-40 items-center gap-2">
          <span className="text-xs tabular-nums text-gray-700 dark:text-gray-300">
            {formatTime(position as Milliseconds)}
          </span>
          <div ref={sliderRef} className="relative flex-1 flex items-center">
            <BookmarkMarkers
              bookmarks={bookmarks}
              durationMs={duration}
              lastPlayStartMs={lastPlayStartMs}
              overlay={bookmarkOverlay}
              onOverlayChange={setBookmarkOverlay}
              onSelect={selectBookmark}
              onListen={jumpAndPlay}
            />
            <input
              className={`position-slider w-full h-2 rounded-lg appearance-none ${
                loopOn ? "" : "loop-off"
              }`}
              style={loopBandStyle(loopStartMs, loopEndMs, duration)}
              type="range"
              aria-label="Position"
              min={0}
              max={duration}
              value={position}
              onChange={(e) => handleSliderChange(Number(e.target.value))}
            />
          </div>
          <span className="text-xs tabular-nums text-gray-700 dark:text-gray-300">
            {formatTime(duration as Milliseconds)}
          </span>
        </div>

        <div className="order-first">
          <ControlButton
            enlargedHitArea={true}
            variant="primary"
            title={paused ? "Play (Space)" : "Pause (Space)"}
            disabled={false}
            onClick={togglePlay}
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
          </ControlButton>
        </div>
        <BookmarkControls
          bookmarks={bookmarks}
          positionMs={position}
          lastPlayStartMs={lastPlayStartMs}
          enableShortcuts={shortcutsActive}
          overlay={bookmarkOverlay}
          onOverlayChange={setBookmarkOverlay}
          onSelect={selectBookmark}
          onJump={jumpAndPlay}
          onEdit={editBookmark}
          loop={loopKey === null ? null : { on: loopOn, toggle: toggleLoop }}
        />
      </div>
    </div>
  );
}
