import { useState, useEffect, useRef, useCallback } from "react";
import startSpotifyOauthFlow, { isOnServerMachine } from "../spotifyoauth";

interface TokenResponse {
  accessToken: string;
  expiresInSeconds: number;
}

export function useAccessToken() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const expiresAtRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch(
        `http://${window.location.hostname}:3000/spotify`,
      );
      const data: TokenResponse = await res.json();
      console.log(JSON.stringify(data));
      if (data.accessToken === null) {
        if (isOnServerMachine()) {
          await startSpotifyOauthFlow(window.location.href);
          return;
        }
        // Other devices wait until someone logs in on the server machine.
        timeoutRef.current = setTimeout(fetchToken, 10000);
        return;
      }

      setAccessToken(data.accessToken);

      // calculate absolute expiry timestamp in ms
      const expiresAt = Date.now() + data.expiresInSeconds * 1000;
      expiresAtRef.current = expiresAt;

      // schedule next refresh slightly before expiration
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      const refreshIn = Math.max(data.expiresInSeconds * 1000 - 5000, 0); // refresh 5s early
      timeoutRef.current = setTimeout(fetchToken, refreshIn);
    } catch (err) {
      console.error("Failed to fetch Spotify token", err);
      setAccessToken(null);
      expiresAtRef.current = null;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(fetchToken, 5000);
    }
  }, []);

  useEffect(() => {
    fetchToken();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [fetchToken]);

  return accessToken;
}
