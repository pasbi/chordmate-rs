import { useEffect, useState } from "react";
import { trackAvailability } from "../lib/spotifyApi";

type Availability = { replacementUri: string | null; playable: boolean };

/** Assumed until the lookup has answered, so that nothing is shown as unavailable too early. */
const UNKNOWN: Availability = { replacementUri: null, playable: true };

/**
 * How `trackUri` can be played in the user's country: the track Spotify plays instead if the
 * linked one was withdrawn, and whether it can be played at all. Looked up once per track.
 */
export function useTrackAvailability(accessToken: string | null, trackUri: string | null) {
  const [result, setResult] = useState<{ trackUri: string; availability: Availability } | null>(
    null
  );

  useEffect(() => {
    if (!accessToken || !trackUri) {
      return;
    }
    let canceled = false;
    trackAvailability(accessToken, trackUri)
      .then((availability) => {
        if (!canceled) {
          setResult({ trackUri, availability });
        }
      })
      .catch(console.error);
    return () => {
      canceled = true;
    };
  }, [accessToken, trackUri]);

  return result?.trackUri === trackUri ? result.availability : UNKNOWN;
}
