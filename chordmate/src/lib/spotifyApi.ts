/** Calls of the Spotify Web API that control playback on any of the user's devices. */

const API_URL = "https://api.spotify.com/v1";

export type SpotifyDevice = {
  id: string;
  name: string;
  type: string;
};

export type PlaybackState = {
  deviceId: string | null;
  paused: boolean;
  position: number; // ms
  duration: number; // ms
  trackUri: string | null;
};

type DevicesResponse = {
  devices: { id: string | null; name: string; type: string }[];
};

type PlayerResponse = {
  device: { id: string | null } | null;
  is_playing: boolean;
  progress_ms: number | null;
  item: { uri: string; duration_ms: number } | null;
};

async function request(
  accessToken: string,
  method: "GET" | "PUT",
  path: string,
  body: object | null
) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body === null ? {} : { "Content-Type": "application/json" }),
    },
    body: body === null ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `Spotify ${method} ${path} failed: ${response.status} ${await response.text()}`
    );
  }
  return response;
}

function deviceQuery(deviceId: string) {
  return `device_id=${encodeURIComponent(deviceId)}`;
}

export async function fetchDevices(accessToken: string): Promise<SpotifyDevice[]> {
  const response = await request(accessToken, "GET", "/me/player/devices", null);
  const { devices }: DevicesResponse = await response.json();
  // Devices without an id can't be controlled (e.g. restricted ones).
  return devices.flatMap(({ id, name, type }) => (id === null ? [] : [{ id, name, type }]));
}

/** The user's current playback anywhere, or null if nothing is active. */
export async function fetchPlaybackState(accessToken: string): Promise<PlaybackState | null> {
  const requestedAt = performance.now();
  const response = await request(accessToken, "GET", "/me/player", null);
  if (response.status === 204) {
    return null;
  }
  const player: PlayerResponse = await response.json();
  // The reported progress is from about half a round trip ago.
  const lag = player.is_playing ? (performance.now() - requestedAt) / 2 : 0;
  return {
    deviceId: player.device?.id ?? null,
    paused: !player.is_playing,
    position: (player.progress_ms ?? 0) + lag,
    duration: player.item?.duration_ms ?? 0,
    trackUri: player.item?.uri ?? null,
  };
}

export async function startPlayback(
  accessToken: string,
  deviceId: string,
  trackUri: string,
  position: number
) {
  await request(accessToken, "PUT", `/me/player/play?${deviceQuery(deviceId)}`, {
    uris: [trackUri],
    position_ms: Math.round(position),
  });
}

export async function pausePlayback(accessToken: string, deviceId: string) {
  await request(accessToken, "PUT", `/me/player/pause?${deviceQuery(deviceId)}`, null);
}

export async function seekPlayback(accessToken: string, deviceId: string, position: number) {
  const query = `position_ms=${Math.round(position)}&${deviceQuery(deviceId)}`;
  await request(accessToken, "PUT", `/me/player/seek?${query}`, null);
}

export async function setPlaybackVolume(accessToken: string, deviceId: string, percent: number) {
  const query = `volume_percent=${Math.round(percent)}&${deviceQuery(deviceId)}`;
  await request(accessToken, "PUT", `/me/player/volume?${query}`, null);
}

/**
 * Moves the user's playback (track and position) to `deviceId`, like choosing a device in the
 * Spotify app. `play` decides whether it continues playing there.
 */
export async function transferPlayback(accessToken: string, deviceId: string, play: boolean) {
  await request(accessToken, "PUT", "/me/player", { device_ids: [deviceId], play });
}
