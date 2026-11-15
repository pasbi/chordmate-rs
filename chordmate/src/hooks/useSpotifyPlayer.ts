import { useEffect, useState } from "react";
import type { SpotifyPlayer } from "../types/global";

const SDK_URL = "https://sdk.scdn.co/spotify-player.js";

/** Start of the name under which ChordMate's browser players appear as Spotify devices. */
export const CHORDMATE_PLAYER_NAME_PREFIX = "ChordMate – ";

const ERROR_EVENTS = [
  "initialization_error",
  "authentication_error",
  "account_error",
  "playback_error",
] as const;

/** A short platform name, so that ChordMate players on different devices can be told apart. */
function platformName() {
  const userAgent = navigator.userAgent;
  if (/Android/i.test(userAgent)) return "Android";
  if (/iPad|iPhone|iPod/.test(userAgent)) return "iOS";
  if (/Windows/.test(userAgent)) return "Windows";
  if (/Mac/.test(userAgent)) return "Mac";
  if (/Linux/.test(userAgent)) return "Linux";
  return "Browser";
}

/**
 * Plays Spotify in this browser through the Web Playback SDK, which registers the browser as a
 * Spotify Connect device. Pass null instead of a token to not create a player at all.
 */
export function useSpotifyPlayer(accessToken: string | null) {
  const [player, setPlayer] = useState<SpotifyPlayer | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  // Without this, a player that can't start (no DRM support, no Premium, …) fails silently.
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    let canceled = false;
    let createdPlayer: SpotifyPlayer | null = null;

    const createPlayer = async () => {
      const newPlayer = new Spotify.Player({
        name: `${CHORDMATE_PLAYER_NAME_PREFIX}${platformName()}`,
        getOAuthToken: (cb) => cb(accessToken),
      });
      createdPlayer = newPlayer;
      newPlayer.addListener("ready", ({ device_id }) => {
        if (!canceled) {
          setDeviceId(device_id);
          setError(null);
        }
      });
      newPlayer.addListener("not_ready", () => {
        if (!canceled) {
          setDeviceId(null);
        }
      });
      for (const event of ERROR_EVENTS) {
        newPlayer.addListener(event, ({ message }) => {
          console.error(`Spotify player ${event}: ${message}`);
          if (!canceled) {
            setError(message);
          }
        });
      }
      if (!(await newPlayer.connect())) {
        if (!canceled) {
          setError("The Spotify player could not connect.");
        }
        return;
      }
      if (!canceled) {
        setPlayer(newPlayer);
      }
    };

    if (window.Spotify) {
      void createPlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = () => void createPlayer();
      if (!document.querySelector(`script[src="${SDK_URL}"]`)) {
        const script = document.createElement("script");
        script.src = SDK_URL;
        script.async = true;
        document.body.appendChild(script);
      }
    }

    // A reload or closed tab skips the cleanup below; without disconnecting, Spotify would list
    // the dead player as a device for several minutes.
    const disconnectOnPageHide = () => createdPlayer?.disconnect();
    window.addEventListener("pagehide", disconnectOnPageHide);

    return () => {
      canceled = true;
      window.removeEventListener("pagehide", disconnectOnPageHide);
      createdPlayer?.disconnect();
      setPlayer(null);
      setDeviceId(null);
      setError(null);
    };
  }, [accessToken]);

  return { player, deviceId, error };
}
