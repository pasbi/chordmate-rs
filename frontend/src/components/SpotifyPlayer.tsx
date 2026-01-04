import { useAccessToken } from "../hooks/useAccessToken";
import { useSpotifyPlayer } from "../hooks/useSpotifyPlayer";
import { useEffect, useRef, useState } from "react";
import { SpotifyPlaybackState } from "../types/global";

export default function SpotifyPlayer({ trackUri }: { trackUri: string }) {
  const accessToken = useAccessToken();
  const { player, deviceId } = useSpotifyPlayer(accessToken, trackUri);
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
    }, 300); // adjust delay as needed
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
            body: JSON.stringify({ uris: [trackUri] }),
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

  return (
    <div>
      <p>Player ready: {player ? "Yes" : "No"}</p>
      <p>Device ID: {deviceId ?? "Waiting..."}</p>
      <button onClick={togglePlay}>{paused ? "Play" : "Pause"}</button>
      <input
        type="range"
        min={0}
        max={duration}
        value={position}
        onChange={(e) => handleSeek(Number(e.target.value))}
      />
      <span>
        {Math.floor(position / 1000)} / {Math.floor(duration / 1000)} sec
      </span>
    </div>
  );
}
