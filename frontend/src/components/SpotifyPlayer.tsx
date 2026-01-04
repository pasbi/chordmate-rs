import { useAccessToken } from "../hooks/useAccessToken";
import { useSpotifyPlayer } from "../hooks/useSpotifyPlayer";
import { useEffect, useRef, useState } from "react";
import { SpotifyPlaybackState } from "../types/global";
import styles from "./SpotifyPlayer.module.css";
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

export default function SpotifyPlayer({ trackId }: { trackId: string }) {
  const accessToken = useAccessToken();
  const { player, deviceId } = useSpotifyPlayer(
    accessToken,
    trackIdToUri(trackId),
  );
  const [paused, setPaused] = useState(true);
  const [duration, setDuration] = useState(0); // in ms

  const [position, setPosition] = useState(0); // in ms
  const seekTimeout = useRef<NodeJS.Timeout | null>(null);
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
  const volumeTimeout = useRef<NodeJS.Timeout | null>(null);
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
        await fetch(
          `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
          {
            method: "PUT",
            body: JSON.stringify({
              uris: [trackIdToUri(trackId)],
              position_ms: position,
            }),
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          },
        );
      } else {
        await fetch(
          `https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`,
          {
            method: "PUT",
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const trackInfo = useTrackInfo(trackId, accessToken);

  function seek(delta: Seconds) {
    player?.seek(position + delta * 1000);
  }

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
      const target =
        event.target instanceof Node ? (event.target as Node) : null;
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
    <div className={styles.player}>
      <img
        className={styles.albumArt}
        src={trackInfo?.albumArtUrl ?? ""}
        alt="Album Art"
      />
      <div className={styles.wrapper}>
        <div className={styles.sliderRow}>
          <span className={styles.currentTime}>
            {formatTime(position as Milliseconds)}
          </span>
          <input
            className={styles.seeker}
            type="range"
            min={0}
            max={duration}
            value={position}
            onChange={(e) => handleSeek(Number(e.target.value))}
          />
          <span className={styles.duration}>
            {formatTime(duration as Milliseconds)}
          </span>
        </div>
        <div className={styles.buttonsRow}>
          <button className={styles.btn} onClick={seekStart}>
            ⇤
          </button>
          <button className={styles.btn} onClick={() => seek(-10 as Seconds)}>
            -10s
          </button>
          <button className={styles.btn} onClick={() => seek(-1 as Seconds)}>
            -1s
          </button>
          <button className={styles.btn} onClick={togglePlay}>
            {" "}
            {paused ? "Play" : "Pause"}{" "}
          </button>
          <button className={styles.btn} onClick={() => seek(1 as Seconds)}>
            +1s
          </button>
          <button className={styles.btn} onClick={() => seek(10 as Seconds)}>
            +10s
          </button>
          <button
            className={styles.volumeButton}
            ref={volumeButtonRef}
            onClick={() => {
              setShowVolumeSlider(!showVolumeSlider);
            }}
          >
            Volume
          </button>
        </div>
        <span>
          {trackInfo?.title ?? ""} — {trackInfo?.artists?.join(", ") ?? ""}
        </span>
      </div>
      {showVolumeSlider && (
        <div ref={volumeContainerRef} className={styles.volumeContainer}>
          <input
            type="range"
            id="volumeSlider"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => {
              setVolumePlayer(Number(e.target.value));
            }}
          />
          <span id="volumeLabel">{volume}%</span>
        </div>
      )}
    </div>
  );
}
