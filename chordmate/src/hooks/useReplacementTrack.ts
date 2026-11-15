import { useEffect, useState } from "react";
import { replacementTrackUri } from "../lib/spotifyApi";

/**
 * The track Spotify plays instead of `trackUri` because the linked one was withdrawn in the
 * user's country, or null. Looked up once per track.
 */
export function useReplacementTrack(accessToken: string | null, trackUri: string | null) {
  const [result, setResult] = useState<{ trackUri: string; replacement: string | null } | null>(
    null
  );

  useEffect(() => {
    if (!accessToken || !trackUri) {
      return;
    }
    let canceled = false;
    replacementTrackUri(accessToken, trackUri)
      .then((replacement) => {
        if (!canceled) {
          setResult({ trackUri, replacement });
        }
      })
      .catch(console.error);
    return () => {
      canceled = true;
    };
  }, [accessToken, trackUri]);

  return result?.trackUri === trackUri ? result.replacement : null;
}
