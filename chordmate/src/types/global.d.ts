export {};

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    // Only defined once the Web Playback SDK script has loaded.
    Spotify?: SpotifyNamespace;
  }

  const Spotify: SpotifyNamespace;
}

interface SpotifyNamespace {
  Player: new (options: {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }) => SpotifyPlayer;
}

interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;

  addListener(event: "ready" | "not_ready", cb: (data: { device_id: string }) => void): boolean;
  addListener(
    event: "player_state_changed",
    cb: (state: SpotifyPlaybackState | null) => void
  ): boolean;
  addListener(
    event: "initialization_error" | "authentication_error" | "account_error" | "playback_error",
    cb: (error: { message: string }) => void
  ): boolean;
  getCurrentState(): Promise<SpotifyPlaybackState | null>;
  removeListener(event: string): boolean;
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
}

interface SpotifyPlaybackState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: {
      uri: string;
      name: string;
    };
  };
}

export type { SpotifyPlayer, SpotifyPlaybackState };
