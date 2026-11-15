import type { SpotifyDevice } from "../lib/spotifyApi";
import { CHORDMATE_PLAYER_NAME_PREFIX } from "../hooks/useSpotifyPlayer";

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
    <label className="flex items-center gap-2 px-1 py-1 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
      <input
        type="radio"
        name="playback-device"
        checked={selected}
        onChange={() => onSelect(option.name)}
      />
      <span className="flex flex-col leading-tight">
        <span>{option.label}</span>
        <span className="text-xs text-gray-600 dark:text-gray-400">{option.detail}</span>
      </span>
    </label>
  );
}

/**
 * Chooses where music plays: in this browser, or on another Spotify Connect device such as the
 * Spotify app on a PC. This browser's own player is offered as "This device"; ChordMate players
 * in other browsers are left out, since they would autoplay their own songs.
 */
export function PlaybackDevicePicker({
  devices,
  targetName,
  onSelect,
  onRefresh,
}: {
  /** Null while loading. */
  devices: SpotifyDevice[] | null;
  targetName: string | null;
  onSelect: (name: string | null) => void;
  onRefresh: () => void;
}) {
  const otherDevices = (devices ?? []).filter(
    (device) => !device.name.startsWith(CHORDMATE_PLAYER_NAME_PREFIX)
  );
  const options: Option[] = [
    { name: null, label: "This device", detail: "Plays in this browser" },
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

  return (
    <fieldset className="flex flex-col gap-1 w-64">
      <legend className="flex w-full items-center justify-between mb-1 text-sm font-semibold">
        Play on
        <button
          type="button"
          onClick={onRefresh}
          className="text-xs font-normal text-blue-600 dark:text-blue-400 hover:underline"
        >
          Refresh
        </button>
      </legend>
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
