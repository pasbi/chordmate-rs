import { useCallback, useEffect, useState } from "react";
import { fetchDevices, type SpotifyDevice } from "../lib/spotifyApi";
import { currentDeviceTraits, findOwnSpotifyApp, ownDeviceTypes } from "../lib/ownSpotifyApp";
import { BROWSER_CAN_PLAY, CHORDMATE_PLAYER_NAME_PREFIX } from "./useSpotifyPlayer";

/** Spotify's types for this device, for finding its Spotify app (see lib/ownSpotifyApp.ts). */
const OWN_DEVICE_TYPES = ownDeviceTypes(currentDeviceTraits());

const STORAGE_KEY = "chordmate.playbackDevice";
const MISSING_DEVICE_RETRY_MS = 10000;

function readStoredDeviceName() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeDeviceName(name: string | null) {
  try {
    if (name === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, name);
    }
  } catch {
    // Not remembered, but still used for this page.
  }
}

/**
 * Where this device plays music: itself (`targetName` null), or another Spotify Connect device,
 * e.g. the Spotify app on a PC. The choice is remembered per device, by name, because Spotify's
 * device ids can change. "Itself" is this browser where Spotify's player works in it, and
 * otherwise the Spotify app on this device (`ownApp`), which must be open to be found.
 */
export function usePlaybackDevice(accessToken: string | null) {
  const [targetName, setTargetNameState] = useState(readStoredDeviceName);
  const [devices, setDevices] = useState<SpotifyDevice[] | null>(null);

  const setTargetName = useCallback((name: string | null) => {
    setTargetNameState(name);
    storeDeviceName(name);
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    try {
      setDevices(await fetchDevices(accessToken));
    } catch (err) {
      console.error(err);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    let canceled = false;
    fetchDevices(accessToken)
      .then((list) => {
        if (!canceled) {
          setDevices(list);
        }
      })
      .catch(console.error);
    return () => {
      canceled = true;
    };
  }, [accessToken]);

  const otherDevices = (devices ?? []).filter(
    (device) => !device.name.startsWith(CHORDMATE_PLAYER_NAME_PREFIX)
  );
  const ownApp = BROWSER_CAN_PLAY ? null : findOwnSpotifyApp(otherDevices, OWN_DEVICE_TYPES);
  const target =
    targetName === null
      ? ownApp
      : (otherDevices.find((device) => device.name === targetName) ?? null);
  // This browser needs no listed device; anything else does.
  const remote = targetName !== null || !BROWSER_CAN_PLAY;
  const targetMissing = remote && target === null;

  // The chosen device may appear later, e.g. once Spotify is started on it.
  useEffect(() => {
    if (!targetMissing) {
      return;
    }
    const interval = setInterval(() => void refreshDevices(), MISSING_DEVICE_RETRY_MS);
    return () => clearInterval(interval);
  }, [targetMissing, refreshDevices]);

  const missingMessage =
    targetName === null
      ? "Open the Spotify app on this device; playback starts here once it's open."
      : `“${targetName}” is not available. Start Spotify there, or choose another device under “Play on” in the ☰ menu.`;
  return {
    targetName,
    setTargetName,
    /** Whether playback is controlled on a listed device rather than played in this browser. */
    remote,
    targetDeviceId: target?.id ?? null,
    /** The device that plays, for messages; null for this browser. */
    targetLabel: remote ? (target?.name ?? targetName ?? "the Spotify app on this device") : null,
    /** Why the chosen device can't play: it isn't among the user's devices (yet). */
    problem: targetMissing && devices !== null ? missingMessage : null,
    /** The Spotify app on this device, where it stands in for this browser. */
    ownApp,
    devices,
    refreshDevices,
  };
}
