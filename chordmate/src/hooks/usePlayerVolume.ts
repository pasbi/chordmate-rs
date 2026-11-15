import { type DeviceNumberSetting, useDeviceNumber } from "./useDeviceNumber";

const PLAYER_VOLUME: DeviceNumberSetting = {
  storageKey: "chordmate.playerVolume",
  // 100 matches the Spotify player's own default.
  defaultValue: 100,
  min: 0,
  max: 100,
};

/** Spotify player volume as a linear slider value (0–100), remembered per device. */
export function usePlayerVolume() {
  const { value: volume, setValue: setVolume } = useDeviceNumber(PLAYER_VOLUME);
  return { volume, setVolume };
}
