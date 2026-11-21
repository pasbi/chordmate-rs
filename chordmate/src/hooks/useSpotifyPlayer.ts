import { useEffect, useRef, useState } from "react";
import type { SpotifyPlayer } from "../types/global";

const SDK_URL = "https://sdk.scdn.co/spotify-player.js";

/** Start of the name under which ChordMate's browser players appear as Spotify devices. */
export const CHORDMATE_PLAYER_NAME_PREFIX = "ChordMate – ";

/**
 * How long a playback error stays visible. Unlike the other errors, it is about one refused
 * command (e.g. “The operation is not allowed.”); the player keeps working.
 */
const PLAYBACK_ERROR_SHOWN_MS = 8000;

const ERROR_EVENTS = [
  "initialization_error",
  "authentication_error",
  "account_error",
  "playback_error",
] as const;

/** Where to turn when this browser can't play. */
const CHOOSE_ANOTHER_DEVICE =
  "Choose another device under “Play on” in the ☰ menu, e.g. the PC's Spotify.";

/**
 * Why Spotify's player can't work in this page at all, or null if it may. It needs DRM
 * (Encrypted Media Extensions), which browsers only offer on secure pages: HTTPS or localhost.
 * Without it, the player doesn't fail but hangs (Firefox for Android over plain http).
 */
function unsupportedReason() {
  if (!window.isSecureContext || typeof navigator.requestMediaKeySystemAccess !== "function") {
    return `Spotify can't play in this browser on a page without HTTPS. ${CHOOSE_ANOTHER_DEVICE}`;
  }
  return null;
}

const UNSUPPORTED_REASON = unsupportedReason();

/** Whether Spotify's player can work in this browser (see unsupportedReason). */
export const BROWSER_CAN_PLAY = UNSUPPORTED_REASON === null;

/** A player not ready by then has most likely hung (e.g. on a mobile browser). */
const READY_TIMEOUT_MS = 20000;

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
export function useSpotifyPlayer(accessToken: string | null): {
  player: SpotifyPlayer | null;
  deviceId: string | null;
  error: string | null;
} {
  const [player, setPlayer] = useState<SpotifyPlayer | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  // Without this, a player that can't start (no DRM support, no Premium, …) fails silently.
  const [error, setError] = useState<string | null>(null);

  // The player asks for a token whenever it needs one, so a renewed token doesn't require a new
  // player; recreating it would interrupt playback.
  const latestToken = useRef(accessToken);
  useEffect(() => {
    latestToken.current = accessToken;
  }, [accessToken]);
  const enabled = accessToken !== null && UNSUPPORTED_REASON === null;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let canceled = false;
    let createdPlayer: SpotifyPlayer | null = null;
    let playbackErrorTimeout: number | null = null;

    let ready = false;
    // The player reports neither readiness nor an error in some browsers; say so after a while.
    const readyTimeout = window.setTimeout(() => {
      if (!ready && !canceled) {
        setError(`Spotify's player didn't start in this browser. ${CHOOSE_ANOTHER_DEVICE}`);
      }
    }, READY_TIMEOUT_MS);

    const createPlayer = async () => {
      const newPlayer = new Spotify.Player({
        name: `${CHORDMATE_PLAYER_NAME_PREFIX}${platformName()}`,
        getOAuthToken: (cb) => {
          if (latestToken.current) {
            cb(latestToken.current);
          }
        },
      });
      createdPlayer = newPlayer;
      newPlayer.addListener("ready", ({ device_id }) => {
        ready = true;
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
          if (canceled) {
            return;
          }
          const shown = `Spotify player error: ${message}`;
          setError(shown);
          if (playbackErrorTimeout !== null) {
            clearTimeout(playbackErrorTimeout);
            playbackErrorTimeout = null;
          }
          if (event === "playback_error") {
            playbackErrorTimeout = window.setTimeout(() => {
              playbackErrorTimeout = null;
              // Unless a lasting error replaced it meanwhile.
              setError((current) => (current === shown ? null : current));
            }, PLAYBACK_ERROR_SHOWN_MS);
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

    // Load the SDK anew for every player. A second player created from an already loaded SDK in
    // the same page (after leaving and reopening a song) never became ready.
    window.onSpotifyWebPlaybackSDKReady = () => void createPlayer();
    document.querySelector(`script[src="${SDK_URL}"]`)?.remove();
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    document.body.appendChild(script);

    // A reload or closed tab skips the cleanup below; without disconnecting, Spotify would list
    // the dead player as a device for several minutes.
    const disconnectOnPageHide = () => createdPlayer?.disconnect();
    window.addEventListener("pagehide", disconnectOnPageHide);

    return () => {
      canceled = true;
      clearTimeout(readyTimeout);
      if (playbackErrorTimeout !== null) {
        clearTimeout(playbackErrorTimeout);
      }
      window.removeEventListener("pagehide", disconnectOnPageHide);
      createdPlayer?.disconnect();
      setPlayer(null);
      setDeviceId(null);
      setError(null);
    };
  }, [enabled]);

  if (accessToken !== null && UNSUPPORTED_REASON !== null) {
    return { player: null, deviceId: null, error: UNSUPPORTED_REASON };
  }
  return { player, deviceId, error };
}
