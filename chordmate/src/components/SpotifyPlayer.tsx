import { type AccessTokenStatus, useAccessToken } from "../hooks/useAccessToken";
import { useSpotifyPlayer } from "../hooks/useSpotifyPlayer";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { SpotifyPlaybackState } from "../types/global";
import { isTypingTarget } from "../lib/isTypingTarget";

type Milliseconds = number & { readonly __unit: "ms" };
type Seconds = number & { readonly __unit: "s" };

function formatTime(duration: Milliseconds): string {
  const totalSeconds = (duration / 1000) as Seconds;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export interface TrackInfo {
  title: string;
  artists: string[];
  albumArtUrl: string | null;
}

function trackIdToUri(trackId: string) {
  return `spotify:track:${trackId}`;
}

function accessTokenStatusMessage(status: AccessTokenStatus): string | null {
  switch (status) {
    case "waitingForLogin":
      return "Not connected to Spotify. Log in on the machine running the Chordmate server; playback starts here automatically.";
    case "serverUnreachable":
      return "Cannot reach the Chordmate server. Retrying…";
    case "loading":
    case "ready":
      return null;
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

function ControlButton({
  onClick,
  title,
  variant,
  children,
}: {
  onClick: () => void;
  title: string;
  variant: "primary" | "secondary";
  children: ReactNode;
}) {
  const colors =
    variant === "primary"
      ? "min-w-12 bg-blue-500 hover:bg-blue-600 text-white"
      : "min-w-9 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600";
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`h-8 px-1.5 flex items-center justify-center rounded text-sm font-medium tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${colors}`}
    >
      {children}
    </button>
  );
}

const SLIDER_SEEK_DELAY_MS = 300;
const POLL_INTERVAL_MS = 500;

export default function SpotifyPlayer({
  trackId,
  enableShortcuts,
  volume,
}: {
  trackId: string;
  enableShortcuts: boolean;
  /** Linear slider value, 0–100. */
  volume: number;
}) {
  const { accessToken, status: accessTokenStatus } = useAccessToken();
  const statusMessage = accessTokenStatusMessage(accessTokenStatus);
  const { player, deviceId } = useSpotifyPlayer(accessToken, trackIdToUri(trackId));
  const [paused, setPaused] = useState(true);
  const [duration, setDuration] = useState(0); // in ms
  const [position, setPosition] = useState(0); // in ms
  // The track the player actually has loaded; differs from `trackId` after linking another track.
  const [loadedTrackUri, setLoadedTrackUri] = useState<string | null>(null);
  const showsLinkedTrack = loadedTrackUri === trackIdToUri(trackId);
  const displayedPosition = showsLinkedTrack ? position : 0;
  const displayedDuration = showsLinkedTrack ? duration : 0;

  // Linking another track pauses the old one instead of playing the new one; Play then starts
  // the new track from the beginning.
  const previousTrackId = useRef(trackId);
  useEffect(() => {
    if (previousTrackId.current === trackId) {
      return;
    }
    previousTrackId.current = trackId;
    player?.pause().catch(console.error);
  }, [player, trackId]);

  // While the user drags the slider, player updates must not move it back.
  const scrubbingRef = useRef(false);
  const sliderSeekTimeout = useRef<number | null>(null);
  const handleSliderChange = (newPosition: number) => {
    scrubbingRef.current = true;
    setPosition(newPosition);
    if (sliderSeekTimeout.current) {
      clearTimeout(sliderSeekTimeout.current);
    }
    sliderSeekTimeout.current = setTimeout(() => {
      if (!player) {
        scrubbingRef.current = false;
        return;
      }
      player
        .seek(newPosition)
        .catch(console.error)
        .finally(() => (scrubbingRef.current = false));
    }, SLIDER_SEEK_DELAY_MS);
  };

  // Applied with a delay, so that dragging the volume slider doesn't flood the player with calls.
  useEffect(() => {
    if (!player) {
      return;
    }
    const timeout = setTimeout(() => {
      player.setVolume(sliderToVolume(volume)).catch(console.error);
    }, SLIDER_SEEK_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [player, volume]);

  useEffect(() => {
    if (!player) return;

    const applyState = (state: SpotifyPlaybackState | null) => {
      if (!state) {
        return;
      }
      setPaused(state.paused);
      setDuration(state.duration);
      setLoadedTrackUri(state.track_window.current_track.uri);
      if (!scrubbingRef.current) {
        setPosition(state.position);
      }
    };

    player.addListener("player_state_changed", applyState);
    const interval = setInterval(
      async () => applyState(await player.getCurrentState()),
      POLL_INTERVAL_MS
    );

    return () => {
      player.removeListener("player_state_changed");
      clearInterval(interval);
    };
  }, [player]);

  const togglePlay = useCallback(async () => {
    if (!deviceId || !accessToken) {
      return;
    }

    try {
      if (paused) {
        await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
          method: "PUT",
          body: JSON.stringify({
            uris: [trackIdToUri(trackId)],
            position_ms: displayedPosition,
          }),
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });
      } else {
        await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
    } catch (err) {
      console.error(err);
    }
  }, [deviceId, accessToken, paused, trackId, displayedPosition]);

  // Seeks run one after another, each relative to the player's actual position at that moment,
  // so that quickly repeated presses add up exactly.
  const seekQueue = useRef(Promise.resolve());
  const seekTo = useCallback(
    (targetOf: (state: SpotifyPlaybackState) => number) => {
      if (!player) {
        return;
      }
      seekQueue.current = seekQueue.current
        .then(async () => {
          const state = await player.getCurrentState();
          if (!state) {
            return;
          }
          const target = Math.min(Math.max(targetOf(state), 0), state.duration);
          await player.seek(target);
          setPosition(target);
        })
        .catch(console.error);
    },
    [player]
  );
  const seekBy = useCallback(
    (delta: Seconds) => seekTo((state) => state.position + delta * 1000),
    [seekTo]
  );
  const seekStart = () => seekTo(() => 0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!enableShortcuts || isTypingTarget(e.target)) {
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
  }, [enableShortcuts, togglePlay, seekBy]);

  // One row, buttons left of the slider. Only when the slider would get narrower than its basis
  // does it wrap onto its own full-width line below the buttons.
  return (
    <div className="flex flex-col gap-1">
      {statusMessage && (
        <p className="text-xs text-amber-700 dark:text-amber-400">{statusMessage}</p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <div className="flex flex-1 basis-40 items-center gap-2">
          <span className="text-xs tabular-nums text-gray-700 dark:text-gray-300">
            {formatTime(displayedPosition as Milliseconds)}
          </span>
          <input
            className="flex-1 h-2 rounded-lg appearance-none bg-gray-300 dark:bg-gray-600"
            type="range"
            aria-label="Position"
            min={0}
            max={displayedDuration}
            value={displayedPosition}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
          />
          <span className="text-xs tabular-nums text-gray-700 dark:text-gray-300">
            {formatTime(displayedDuration as Milliseconds)}
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
      </div>
    </div>
  );
}
