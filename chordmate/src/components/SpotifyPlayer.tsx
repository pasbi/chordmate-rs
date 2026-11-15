import type { AccessTokenStatus } from "../hooks/useAccessToken";
import type { Playback } from "../hooks/usePlayback";
import type { PlaybackState } from "../lib/spotifyApi";
import type { Bookmarks } from "../hooks/useBookmarks";
import { useCallback, useEffect, useRef, useState } from "react";
import { isTypingTarget } from "../lib/isTypingTarget";
import { formatTime, type Milliseconds, type Seconds } from "../lib/time";
import { type BookmarkOverlay, BookmarkControls, BookmarkTicks } from "./BookmarkControls";
import { ControlButton } from "./ControlButton";

function trackIdToUri(trackId: string) {
  return `spotify:track:${trackId}`;
}

function statusMessage(
  accessTokenStatus: AccessTokenStatus,
  unavailableDeviceName: string | null,
  playerError: string | null
): string | null {
  switch (accessTokenStatus) {
    case "waitingForLogin":
      return "Not connected to Spotify. Log in on the machine running the Chordmate server; playback starts here automatically.";
    case "serverUnreachable":
      return "Cannot reach the Chordmate server. Retrying…";
    case "loading":
      return null;
    case "ready":
      if (unavailableDeviceName !== null) {
        return `“${unavailableDeviceName}” is not available. Start Spotify there, or choose another device under 🔊.`;
      }
      return playerError === null ? null : `Spotify player error: ${playerError}`;
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

const SLIDER_SEEK_DELAY_MS = 300;
const DISPLAY_TICK_MS = 250;

/** A polled playback state and when it was taken, to move the position on between polls. */
type Sample = { state: PlaybackState | null; takenAt: number };

export default function SpotifyPlayer({
  trackId,
  bookmarks,
  enableShortcuts,
  volume,
  playback,
  accessTokenStatus,
  unavailableDeviceName,
  playerError,
}: {
  trackId: string;
  /** The bookmarks of the song in this track. */
  bookmarks: Bookmarks;
  enableShortcuts: boolean;
  /** Linear slider value, 0–100. */
  volume: number;
  /** Null while no device is ready to play. */
  playback: Playback | null;
  accessTokenStatus: AccessTokenStatus;
  /** Name of the chosen output device while it is unavailable. */
  unavailableDeviceName: string | null;
  /** Why this browser's player can't start, if it can't. */
  playerError: string | null;
}) {
  const message = statusMessage(accessTokenStatus, unavailableDeviceName, playerError);
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
    const poll = () => refresh().catch(console.error);
    poll();
    const interval = setInterval(poll, playback.pollIntervalMs);
    return () => clearInterval(interval);
  }, [playback, refresh]);

  // This song's state; null while the device has another track loaded (e.g. after linking a
  // new track, or when something else was started there).
  const state = sample.state?.trackUri === trackUri ? sample.state : null;
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
        .catch(console.error)
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
      playback.setVolume(sliderToVolume(volume)).catch(console.error);
    }, SLIDER_SEEK_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [playback, volume]);

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
        current?.trackUri === trackUri && !current.paused ? undefined : playback.play(trackUri, 0)
      )
      .then(refresh)
      .catch(console.error);
  }, [playback, trackUri, refresh]);

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
      playback.transferHere(wasPlaying.current).then(refresh).catch(console.error);
    }
  }, [playback, refresh]);

  // Linking another track pauses the old one instead of playing the new one; Play then starts
  // the new track from the beginning.
  const previousTrackId = useRef(trackId);
  useEffect(() => {
    if (previousTrackId.current === trackId) {
      return;
    }
    previousTrackId.current = trackId;
    playback?.pause().catch(console.error);
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
      console.error(err);
    }
    // Also after a failure, so that the controls show the actual state instead of a stale one.
    await refresh().catch(console.error);
  }, [playback, paused, trackUri, position, refresh]);

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
        .catch(console.error);
    },
    [playback]
  );
  const seekBy = useCallback(
    (delta: Seconds) => seekTo((current) => current.position + delta * 1000),
    [seekTo]
  );
  const seekStart = () => seekTo(() => 0);

  /** Moves to a position in this song's track and plays, whatever the device did before. */
  const jumpAndPlay = useCallback(
    (positionMs: number) => {
      if (!playback) {
        return;
      }
      seekQueue.current = seekQueue.current
        .then(async () => {
          const current = await playback.currentState();
          if (current?.trackUri === trackUri && !current.paused) {
            const target = Math.min(Math.max(positionMs, 0), current.duration);
            await playback.seek(target);
            setSample({ state: { ...current, position: target }, takenAt: performance.now() });
          } else {
            await playback.play(trackUri, Math.max(positionMs, 0));
            await refresh();
          }
        })
        .catch(console.error);
    },
    [playback, trackUri, refresh]
  );

  // The bookmark menu and manager take the keyboard while they are open.
  const [bookmarkOverlay, setBookmarkOverlay] = useState<BookmarkOverlay>(null);
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
          {/* The bookmark ticks lie under the slider, taller than its track, so that the thumb
              covers them as it passes. */}
          <div className="relative flex-1 flex items-center">
            <BookmarkTicks bookmarks={bookmarks} durationMs={duration} />
            <input
              className="relative w-full h-2 rounded-lg appearance-none bg-gray-300 dark:bg-gray-600"
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

        <div className="flex items-center gap-1 order-first">
          <ControlButton variant="secondary" title="Back to start" onClick={seekStart}>
            ⇤
          </ControlButton>
          <ControlButton
            variant="secondary"
            title="Back 10 s (Ctrl+←)"
            onClick={() => seekBy(-10 as Seconds)}
          >
            −10
          </ControlButton>
          <ControlButton
            variant="secondary"
            title="Back 1 s (←)"
            onClick={() => seekBy(-1 as Seconds)}
          >
            −1
          </ControlButton>
          <ControlButton
            variant="primary"
            title={paused ? "Play (Space)" : "Pause (Space)"}
            onClick={togglePlay}
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
          </ControlButton>
          <ControlButton
            variant="secondary"
            title="Forward 1 s (→)"
            onClick={() => seekBy(1 as Seconds)}
          >
            +1
          </ControlButton>
          <ControlButton
            variant="secondary"
            title="Forward 10 s (Ctrl+→)"
            onClick={() => seekBy(10 as Seconds)}
          >
            +10
          </ControlButton>
        </div>
        <BookmarkControls
          bookmarks={bookmarks}
          positionMs={position}
          durationMs={duration}
          lastPlayStartMs={lastPlayStartMs}
          enableShortcuts={shortcutsActive}
          overlay={bookmarkOverlay}
          onOverlayChange={setBookmarkOverlay}
          onJump={jumpAndPlay}
        />
      </div>
    </div>
  );
}
