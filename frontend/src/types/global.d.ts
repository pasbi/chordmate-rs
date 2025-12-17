export {};

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: SpotifyNamespace;
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

  addListener(
    event:
      | "ready"
      | "not_ready"
      | "player_state_changed"
      | "initialization_error"
      | "authentication_error"
      | "account_error",
    cb: (data: any) => void,
  ): boolean;

  removeListener(event: string): boolean;
}

export type { SpotifyPlayer };
