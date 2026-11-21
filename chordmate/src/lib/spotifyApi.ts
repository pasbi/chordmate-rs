/** Calls of the Spotify Web API that control playback on any of the user's devices. */

const API_URL = "https://api.spotify.com/v1";

export type SpotifyDevice = {
  id: string;
  name: string;
  /** Spotify's device type: "Computer", "Smartphone", "Tablet", "Speaker", … */
  type: string;
  /** Whether it is the device currently playing or last played on. */
  isActive: boolean;
};

export type PlaybackState = {
  deviceId: string | null;
  paused: boolean;
  position: number; // ms
  duration: number; // ms
  trackUri: string | null;
  /**
   * The track that was asked for, when Spotify plays a replacement instead ("track relinking"):
   * a linked track that is no longer available in the user's country is replaced by an
   * equivalent one, e.g. a remaster that moved to another release.
   */
  linkedFromUri: string | null;
  trackName: string | null;
};

/**
 * Whether `state` plays `trackUri`: the track itself, its known replacement (played directly,
 * e.g. from the replacement's own album), or a replacement Spotify substituted on request.
 */
export function playsTrack(
  state: PlaybackState | null,
  trackUri: string,
  replacementUri: string | null
) {
  return (
    state !== null &&
    (state.trackUri === trackUri ||
      (replacementUri !== null && state.trackUri === replacementUri) ||
      state.linkedFromUri === trackUri)
  );
}

type DevicesResponse = {
  devices: { id: string | null; name: string; type: string; is_active: boolean }[];
};

type PlayerResponse = {
  device: { id: string | null } | null;
  is_playing: boolean;
  progress_ms: number | null;
  item: {
    uri: string;
    name: string;
    duration_ms: number;
    linked_from: { uri: string } | null;
  } | null;
};

type TrackResponse = {
  uri: string;
  /** Only reported when asked with a market; false if the track can't be played there. */
  is_playable?: boolean;
  album: { uri: string } | null;
};

/** A request Spotify refused, with its status and Spotify's own explanation. */
export class SpotifyApiError extends Error {
  readonly status: number;
  readonly spotifyMessage: string;

  constructor(method: string, path: string, status: number, body: string) {
    super(`Spotify ${method} ${path} failed: ${status} ${body}`);
    this.status = status;
    this.spotifyMessage = spotifyErrorMessage(body) ?? `error ${status}`;
  }
}

/** The message in Spotify's error body ({"error": {"message": …}}), if it has one. */
function spotifyErrorMessage(body: string) {
  try {
    const parsed: unknown = JSON.parse(body);
    const message = (parsed as { error?: { message?: unknown } }).error?.message;
    return typeof message === "string" && message !== "" ? message : null;
  } catch {
    return null;
  }
}

/** A short explanation of a failed Spotify call, for the player's status line. */
export function describeSpotifyFailure(err: unknown) {
  if (err instanceof SpotifyApiError) {
    return err.spotifyMessage;
  }
  // fetch rejects with a TypeError when the network fails.
  if (err instanceof TypeError) {
    return "Spotify can't be reached";
  }
  return err instanceof Error ? err.message : String(err);
}

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
    // Commands must also arrive when sent while the page closes (e.g. pausing on leaving).
    keepalive: method === "PUT",
  });
  if (!response.ok) {
    throw new SpotifyApiError(method, path, response.status, await response.text());
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
  return devices.flatMap(({ id, name, type, is_active }) =>
    id === null ? [] : [{ id, name, type, isActive: is_active }]
  );
}

/** The user's current playback anywhere, or null if nothing is active. */
export async function fetchPlaybackState(accessToken: string): Promise<PlaybackState | null> {
  const requestedAt = performance.now();
  // With the market, Spotify reports replaced tracks (linked_from).
  const response = await request(accessToken, "GET", "/me/player?market=from_token", null);
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
    linkedFromUri: player.item?.linked_from?.uri ?? null,
    trackName: player.item?.name ?? null,
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

type PlayableTrack = { trackUri: string; albumUri: string | null; playable: boolean };
const playableTracks = new Map<string, PlayableTrack>();

/**
 * The track Spotify actually plays for `trackUri` in the user's country (a replacement if the
 * linked one was withdrawn) and its album. Looked up once per track.
 */
async function playableTrackOf(accessToken: string, trackUri: string) {
  const known = playableTracks.get(trackUri);
  if (known) {
    return known;
  }
  let track = await fetchTrack(accessToken, trackUri);
  if (track.uri !== trackUri) {
    // Replaced: the album reported with it can be the withdrawn track's album, which lists the
    // song under yet another id. The replacement's own album lists it under its id.
    track = await fetchTrack(accessToken, track.uri);
  }
  const playable = {
    trackUri: track.uri,
    albumUri: track.album?.uri ?? null,
    playable: track.is_playable !== false,
  };
  playableTracks.set(trackUri, playable);
  return playable;
}

/** How `trackUri` can be played in the user's country. */
export async function trackAvailability(accessToken: string, trackUri: string) {
  const track = await playableTrackOf(accessToken, trackUri);
  return {
    /** The track Spotify plays instead, or null if it plays `trackUri` itself. */
    replacementUri: track.trackUri === trackUri ? null : track.trackUri,
    /** False if the track can't be played at all, not even through a replacement. */
    playable: track.playable,
  };
}

/** A track as available in the user's country (`market=from_token`). */
async function fetchTrack(accessToken: string, trackUri: string): Promise<TrackResponse> {
  const trackId = trackUri.split(":").at(-1);
  const response = await request(accessToken, "GET", `/tracks/${trackId}?market=from_token`, null);
  return response.json();
}

/**
 * Plays a track as part of its album, i.e. "play album X from this track", like Spotify's own
 * apps do. The Spotify desktop app on Linux handles only the first plain track play
 * (`startPlayback`) after it starts; later ones restart the current song and queue the requested
 * one behind it. Playing within the album works every time. Afterwards the album continues.
 */
export async function startPlaybackInAlbum(
  accessToken: string,
  deviceId: string,
  trackUri: string,
  position: number
) {
  // A withdrawn track's own album isn't available either; use the replacement and its album.
  const playable = await playableTrackOf(accessToken, trackUri);
  if (playable.albumUri === null) {
    await startPlayback(accessToken, deviceId, trackUri, position);
    return;
  }
  await request(accessToken, "PUT", `/me/player/play?${deviceQuery(deviceId)}`, {
    context_uri: playable.albumUri,
    offset: { uri: playable.trackUri },
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
