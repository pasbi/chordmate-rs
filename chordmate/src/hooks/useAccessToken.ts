import { useState, useEffect } from "react";
import startSpotifyOauthFlow, { isOnServerMachine } from "../spotifyoauth";

interface TokenResponse {
  accessToken: string | null;
  expiresInSeconds: number;
}

const WAIT_FOR_LOGIN_MS = 10000;
const RETRY_AFTER_ERROR_MS = 5000;
const REFRESH_MARGIN_MS = 5000;

export function useAccessToken() {
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let timeout: number | undefined;
    let cancelled = false;

    const scheduleFetch = (delayMs: number) => {
      timeout = setTimeout(fetchToken, delayMs);
    };

    async function fetchToken() {
      try {
        const res = await fetch(`http://${window.location.hostname}:3000/spotify`);
        const data: TokenResponse = await res.json();
        if (cancelled) {
          return;
        }
        if (data.accessToken === null) {
          if (isOnServerMachine()) {
            await startSpotifyOauthFlow(window.location.href);
            return;
          }
          // Other devices wait until someone logs in on the server machine.
          scheduleFetch(WAIT_FOR_LOGIN_MS);
          return;
        }
        setAccessToken(data.accessToken);
        scheduleFetch(Math.max(data.expiresInSeconds * 1000 - REFRESH_MARGIN_MS, 0));
      } catch (err) {
        console.error("Failed to fetch Spotify token", err);
        if (cancelled) {
          return;
        }
        setAccessToken(null);
        scheduleFetch(RETRY_AFTER_ERROR_MS);
      }
    }

    fetchToken();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  return accessToken;
}
