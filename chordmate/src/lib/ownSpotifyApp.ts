/**
 * Finding the Spotify app on the device ChordMate runs on, among the user's Spotify Connect
 * devices, for browsers that can't play Spotify themselves (see useSpotifyPlayer).
 */
import type { SpotifyDevice } from "./spotifyApi.ts";

/** What can be told about this device; the user agent can't, as tablets may ask for desktop sites. */
export interface DeviceTraits {
  /** A finger, not a mouse, is the main pointer. */
  touch: boolean;
  /** The screen's shorter side in CSS pixels. */
  shortSidePx: number;
}

/** Shorter screen sides from this size on are tablets, below it phones. */
const TABLET_MIN_SHORT_SIDE_PX = 600;

export function currentDeviceTraits(): DeviceTraits {
  return {
    touch: window.matchMedia("(pointer: coarse)").matches,
    shortSidePx: Math.min(window.screen.width, window.screen.height),
  };
}

/** Spotify's device types that this device would appear as, the likeliest first. */
export function ownDeviceTypes({ touch, shortSidePx }: DeviceTraits) {
  if (!touch) {
    return ["Computer"];
  }
  return shortSidePx >= TABLET_MIN_SHORT_SIDE_PX
    ? ["Tablet", "Smartphone"]
    : ["Smartphone", "Tablet"];
}

/**
 * This device's Spotify app among `devices`: one of its types, the active one first, then by how
 * likely its type is. Null if none is listed (Spotify lists the app only while it is open).
 */
export function findOwnSpotifyApp(devices: SpotifyDevice[], types: string[]) {
  const rank = (device: SpotifyDevice) =>
    (device.isActive ? 0 : 1) * types.length + types.indexOf(device.type);
  return (
    devices.filter((device) => types.includes(device.type)).sort((a, b) => rank(a) - rank(b))[0] ??
    null
  );
}
