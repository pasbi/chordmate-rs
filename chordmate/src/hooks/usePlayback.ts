import { useMemo } from "react";
import {
  fetchPlaybackState,
  pausePlayback,
  type PlaybackState,
  seekPlayback,
  setPlaybackVolume,
  startPlayback,
  startPlaybackInAlbum,
  transferPlayback,
} from "../lib/spotifyApi";
import { useSpotifyPlayer } from "./useSpotifyPlayer";

/** Controls playback on one Spotify Connect device: this browser, or another device. */
export interface Playback {
  deviceId: string;
  /** How often the state is polled; requests to another device go over the network. */
  pollIntervalMs: number;
  /**
   * Whether the stored volume is applied as soon as the device is ready. Another device keeps
   * its own volume until the volume slider is moved here.
   */
  restoresVolume: boolean;
  /** The device's current state, or null if it plays nothing. */
  currentState(): Promise<PlaybackState | null>;
  play(trackUri: string, position: number): Promise<void>;
  /** Moves the current playback here from whichever device had it. */
  transferHere(play: boolean): Promise<void>;
  pause(): Promise<void>;
  seek(position: number): Promise<void>;
  /** 0–1 */
  setVolume(fraction: number): Promise<void>;
}

/**
 * Playback in this browser when `remote` is false; otherwise remote control of the device
 * `remoteDeviceId`, without creating a player in this browser. `playback` is null until ready;
 * `error` explains why this browser's player can't start.
 */
export function usePlayback(
  accessToken: string | null,
  remote: boolean,
  remoteDeviceId: string | null
): { playback: Playback | null; error: string | null } {
  const { player, deviceId: localDeviceId, error } = useSpotifyPlayer(remote ? null : accessToken);

  const playback = useMemo((): Playback | null => {
    if (!accessToken) {
      return null;
    }
    if (remote) {
      if (!remoteDeviceId) {
        return null;
      }
      return {
        deviceId: remoteDeviceId,
        pollIntervalMs: 1000,
        restoresVolume: false,
        currentState: async () => {
          const state = await fetchPlaybackState(accessToken);
          return state?.deviceId === remoteDeviceId ? state : null;
        },
        play: (trackUri, position) =>
          startPlaybackInAlbum(accessToken, remoteDeviceId, trackUri, position),
        transferHere: (play) => transferPlayback(accessToken, remoteDeviceId, play),
        pause: () => pausePlayback(accessToken, remoteDeviceId),
        seek: (position) => seekPlayback(accessToken, remoteDeviceId, position),
        setVolume: (fraction) => setPlaybackVolume(accessToken, remoteDeviceId, fraction * 100),
      };
    }
    if (!player || !localDeviceId) {
      return null;
    }
    return {
      deviceId: localDeviceId,
      pollIntervalMs: 500,
      restoresVolume: true,
      currentState: async () => {
        const state = await player.getCurrentState();
        return (
          state && {
            deviceId: localDeviceId,
            paused: state.paused,
            position: state.position,
            duration: state.duration,
            trackUri: state.track_window.current_track.uri,
            trackName: state.track_window.current_track.name,
          }
        );
      },
      play: (trackUri, position) => startPlayback(accessToken, localDeviceId, trackUri, position),
      transferHere: (play) => transferPlayback(accessToken, localDeviceId, play),
      pause: () => player.pause(),
      seek: (position) => player.seek(position),
      setVolume: (fraction) => player.setVolume(fraction),
    };
  }, [accessToken, remote, remoteDeviceId, player, localDeviceId]);
  return { playback, error };
}
