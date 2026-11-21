import type { SpotifyDevice } from "../lib/spotifyApi";
import { BROWSER_CAN_PLAY, CHORDMATE_PLAYER_NAME_PREFIX } from "../hooks/useSpotifyPlayer";

type Option = { name: string | null; label: string; detail: string };

function DeviceOption({
  option,
  selected,
  onSelect,
}: {
  option: Option;
  selected: boolean;
  onSelect: (name: string | null) => void;
}) {
  return (
    <label className="flex items-center gap-2 px-1 py-1.5 rounded cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700">
      <input
        type="radio"
        name="playback-device"
        checked={selected}
        onChange={() => onSelect(option.name)}
      />
      <span className="flex flex-col min-w-0 leading-tight">
        <span className="break-words">{option.label}</span>
        <span className="text-xs text-gray-600 dark:text-gray-400 break-words">
          {option.detail}
        </span>
      </span>
    </label>
  );
}

/**
 * Chooses where music plays: on this device, or on another Spotify Connect device such as the
 * Spotify app on a PC. "This device" is this browser's own player, or the Spotify app on this
 * device (`ownApp`) where the browser can't play. ChordMate players in other browsers are left
 * out, since they would autoplay their own songs.
 */
export function PlaybackDevicePicker({
  devices,
  targetName,
  ownApp,
  onSelect,
}: {
  /** Null while loading. */
  devices: SpotifyDevice[] | null;
  targetName: string | null;
  /** The Spotify app on this device, where it plays instead of this browser; null if not open. */
  ownApp: SpotifyDevice | null;
  onSelect: (name: string | null) => void;
}) {
  const otherDevices = (devices ?? []).filter(
    (device) => !device.name.startsWith(CHORDMATE_PLAYER_NAME_PREFIX) && device.id !== ownApp?.id
  );
  const thisDeviceDetail = BROWSER_CAN_PLAY
    ? "this browser"
    : ownApp === null
      ? "Spotify app, not open"
      : `Spotify app, ${ownApp.name}`;
  const options: Option[] = [
    { name: null, label: "This device", detail: thisDeviceDetail },
    ...otherDevices.map((device) => ({
      name: device.name,
      label: device.name,
      detail: device.type,
    })),
  ];
  // Keep a chosen but currently unavailable device visible, so that it stays selected.
  if (targetName !== null && !otherDevices.some((device) => device.name === targetName)) {
    options.push({ name: targetName, label: targetName, detail: "Not available" });
  }

  // The list's label and refresh button are the song menu's (see SongDetail).
  return (
    <fieldset className="flex flex-col gap-1 min-w-0 w-full">
      <legend className="sr-only">Play on</legend>
      {options.map((option) => (
        <DeviceOption
          key={option.name ?? ""}
          option={option}
          selected={option.name === targetName}
          onSelect={onSelect}
        />
      ))}
      {devices === null && <p className="text-xs text-gray-600 dark:text-gray-400">Loading…</p>}
    </fieldset>
  );
}
