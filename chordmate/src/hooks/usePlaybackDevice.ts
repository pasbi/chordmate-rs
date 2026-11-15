import { useCallback, useEffect, useState } from "react";
import { fetchDevices, type SpotifyDevice } from "../lib/spotifyApi";

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
 * device ids can change.
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

  const target = targetName === null ? null : (devices?.find((d) => d.name === targetName) ?? null);
  const targetMissing = targetName !== null && target === null;

  // The chosen device may appear later, e.g. once Spotify is started on it.
  useEffect(() => {
    if (!targetMissing) {
      return;
    }
    const interval = setInterval(() => void refreshDevices(), MISSING_DEVICE_RETRY_MS);
    return () => clearInterval(interval);
  }, [targetMissing, refreshDevices]);

  return {
    targetName,
    setTargetName,
    targetDeviceId: target?.id ?? null,
    /** The chosen device is not among the user's available devices (yet). */
    targetMissing: targetMissing && devices !== null,
    devices,
    refreshDevices,
  };
}
