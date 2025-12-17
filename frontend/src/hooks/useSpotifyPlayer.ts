import { useEffect, useRef, useState } from "react";
import { SpotifyPlayer } from "../types/global";

export function useSpotifyPlayer(accessToken: string | null, trackId: string) {
  const playerRef = useRef<SpotifyPlayer | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new Spotify.Player({
        name: "Web Player",
        getOAuthToken: (cb) => cb(accessToken),
      });

      player.addListener("ready", ({ device_id }) => setDeviceId(device_id));
      let canceled = false;
      (async () => {
        if (!(await player.connect())) {
          console.error("Spotify Player failed to connect.");
          return;
        }
        if (canceled) {
          console.log(
            "Spotify Player connection canceled before the connection was established.",
          );
          return;
        }
        console.log("Spotify Player connected");
        playerRef.current = player;
      })();
      return () => {
        canceled = true;
        player.disconnect();
        playerRef.current = null;
      };
    };

    return () => {
      playerRef.current?.disconnect();
    };
  }, [accessToken]);

  // start playback whenever we have player, deviceId, and trackUri
  useEffect(() => {
    console.log(`Attempt to play ${trackId}`);
    if (!playerRef.current || !deviceId) return;

    const play = async () => {
      const res = await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ uris: [`spotify:track:${trackId}`] }),
        },
      );
      if (res.ok) {
        console.log("Spotify Player plays.");
      } else {
        console.error("Spotify Player failed to play.");
      }
    };

    play();
  }, [accessToken, deviceId, trackId]);

  return { player: playerRef.current, deviceId };
}
