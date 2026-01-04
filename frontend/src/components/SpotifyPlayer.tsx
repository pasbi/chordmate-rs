import { useAccessToken } from "../hooks/useAccessToken";
import { useSpotifyPlayer } from "../hooks/useSpotifyPlayer";
import { useEffect, useRef, useState } from "react";
import { SpotifyPlaybackState } from "../types/global";
import styles from "./SpotifyPlayer.module.css";

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

function useTrackInfo(trackId: string, accessToken: string | null) {
  const [trackInfo, setTrackInfo] = useState<TrackInfo | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setTrackInfo(null);
      return;
    }

    let cancelled = false;
    async function fetchTrackInfo() {
      const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        if (!cancelled) {
          setTrackInfo(null);
        }
        console.error("Failed to fetch track info.");
        return;
      }
      const data = await res.json();
      console.log("Track info", JSON.stringify(data, null, 2));
      if (!cancelled) {
        const images = data.album?.images;
        setTrackInfo({
          title: data.name,
          artists: data.artists.map((artist: any) => artist.name),
          albumArtUrl: data.album.images?.[0]?.url ?? null,
        });
      }
    }

    void fetchTrackInfo();
    return () => {
      cancelled = true;
    };
  }, [trackId, accessToken]);

  return trackInfo;
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
  const [position, setPosition] = useState(0); // in ms
  const [duration, setDuration] = useState(0); // in ms
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
          <button className={styles.btn} onClick={togglePlay}>
            ⇤
          </button>
          <button className={styles.btn} onClick={togglePlay}>
            -10s
          </button>
          <button className={styles.btn} onClick={togglePlay}>
            -1s
          </button>
          <button className={styles.btn} onClick={togglePlay}>
            {" "}
            {paused ? "Play" : "Pause"}{" "}
          </button>
          <button className={styles.btn} onClick={togglePlay}>
            +1s
          </button>
          <button className={styles.btn} onClick={togglePlay}>
            +10s
          </button>
        </div>
        <a href="">
          {trackInfo?.title ?? ""} — {trackInfo?.artists?.join(", ") ?? ""}
        </a>
      </div>
    </div>
  );
}
