import { useAccessToken } from "../hooks/useAccessToken";
import { useSpotifyPlayer } from "../hooks/useSpotifyPlayer";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SpotifyPlaybackState } from "../types/global";
import useTrackInfo from "../hooks/useTrackInfo";

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
  return `spotify:track/${trackId}`;
}

export default function SpotifyPlayer({
  trackId,
  enableShortcuts,
}: {
  trackId: string;
  enableShortcuts: boolean;
}) {
  const accessToken = useAccessToken();
  const { player, deviceId } = useSpotifyPlayer(accessToken, trackIdToUri(trackId));
  const [paused, setPaused] = useState(true);
  const [duration, setDuration] = useState(0); // in ms

  const [position, setPosition] = useState(0); // in ms
  const seekTimeout = useRef<number | null>(null);
  const handleSeek = (newPosition: number) => {
    setPosition(newPosition);
    if (seekTimeout.current) {
      clearTimeout(seekTimeout.current);
    }
    seekTimeout.current = setTimeout(() => {
      if (!player) return;
      player.seek(newPosition).catch(console.error);
    }, 300);
  };

  const [volume, setVolume] = useState(50); // in %
  const volumeTimeout = useRef<number | null>(null);
  const [showVolumeSlider, setShowVolumeSlider] = useState<boolean>(false);
  const setVolumePlayer = (newVolume: number) => {
    setVolume(newVolume);
    if (volumeTimeout.current) {
      clearTimeout(volumeTimeout.current);
    }
    volumeTimeout.current = setTimeout(() => {
      if (!player) return;
      const v = newVolume / 100;
      const k = 2;
      const vv = (Math.exp(k * v) - 1) / (Math.exp(k) - 1);

      player.setVolume(vv).catch(console.error);
    }, 300);
  };

  useEffect(() => {
    if (!player) return;

    const listener = (state: SpotifyPlaybackState) => {
      if (!state) {
        return;
      }
      setPaused(state.paused);
      setPosition(state.position);
      setDuration(state.duration);
    };

    player.addListener("player_state_changed", listener);

    return () => {
      player.removeListener("player_state_changed");
    };
  }, [player]);

  useEffect(() => {
    if (!player) return;

    const interval = setInterval(async () => {
      const state = await player.getCurrentState();
      if (!state) {
        return;
      }
      setPosition(state.position);
      setDuration(state.duration);
      setPaused(state.paused);
    }, 500); // update every 500ms

    return () => clearInterval(interval);
  }, [player]);

  const togglePlay = async () => {
    if (!deviceId || !accessToken) {
      console.log("no play");
      return;
    }

    try {
      if (paused) {
        await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
          method: "PUT",
          body: JSON.stringify({
            uris: [trackIdToUri(trackId)],
            position_ms: position,
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
  };

  const seek = useCallback(
    (delta: Seconds) => {
      player?.seek(position + delta * 1000);
    },
    [player, position]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!enableShortcuts) {
        return;
      }
      switch (e.key) {
        case " ":
          togglePlay();
          e.preventDefault();
          break;
        case "ArrowRight":
          seek((e.ctrlKey ? 10 : 1) as Seconds);
          break;
        case "ArrowLeft":
          seek(-(e.ctrlKey ? 10 : 1) as Seconds);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enableShortcuts, togglePlay, seek]);

  function seekStart() {
    player?.seek(0);
  }

  const volumeContainerRef = useRef<HTMLDivElement | null>(null);
  const volumeButtonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }
      const target = event.target instanceof Node ? (event.target as Node) : null;
      if (
        !volumeContainerRef?.current?.contains(target) &&
        !volumeButtonRef?.current?.contains(target)
      ) {
        setShowVolumeSlider(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);
  return (
    <div
      className={`bg-gray-100 dark:bg-gray-800 rounded-lg p-4 flex flex-col gap-4 transition-all duration-300`}
    >
      <div className="flex gap-4">
        <div className="flex-1 flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {formatTime(position as Milliseconds)}
            </span>
            <input
              className="flex-1 h-2 rounded-lg appearance-none bg-gray-300 dark:bg-gray-600"
              type="range"
              min={0}
              max={duration}
              value={position}
              onChange={(e) => handleSeek(Number(e.target.value))}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {formatTime(duration as Milliseconds)}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            <button
              className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              onClick={seekStart}
            >
              ⇤
            </button>
            <button
              className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              onClick={() => seek(-10 as Seconds)}
            >
              -10s
            </button>
            <button
              className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              onClick={() => seek(-1 as Seconds)}
            >
              -1s
            </button>
            <button
              className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded"
              onClick={togglePlay}
            >
              {paused ? "Play" : "Pause"}
            </button>
            <button
              className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              onClick={() => seek(1 as Seconds)}
            >
              +1s
            </button>
            <button
              className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              onClick={() => seek(10 as Seconds)}
            >
              +10s
            </button>
            <button
              className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              ref={volumeButtonRef}
              onClick={() => setShowVolumeSlider(!showVolumeSlider)}
            >
              Volume
            </button>
          </div>
        </div>
      </div>

      {showVolumeSlider && (
        <div ref={volumeContainerRef} className="mt-2 flex items-center gap-2">
          <input
            type="range"
            id="volumeSlider"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => setVolumePlayer(Number(e.target.value))}
            className="flex-1 h-2 rounded-lg bg-gray-300 dark:bg-gray-600"
          />
          <span id="volumeLabel" className="text-sm text-gray-700 dark:text-gray-300">
            {volume}%
          </span>
        </div>
      )}
    </div>
  );
}
