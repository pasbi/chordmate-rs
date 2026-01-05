import { useEffect, useRef, useState } from "react";
import { TrackInfo } from "../components/SpotifyPlayer";

export default function useTrackInfo(
  trackId: string,
  accessToken: string | null,
) {
  const [trackInfo, setTrackInfo] = useState<TrackInfo | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setTrackInfo(null);
      return;
    }

    let cancelled = false;
    async function fetchTrackInfo() {
      const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        if (!cancelled) {
          setTrackInfo(null);
        }
        console.error("Failed to fetch track info.");
        return;
      }
      const data = await res.json();
      if (!cancelled) {
        const images = data.album?.images;
        setTrackInfo({
          title: data.name,
          artists: data.artists.map((artist: any) => artist.name),
          albumArtUrl: data.album.images?.[0]?.url ?? null,
        });
      }
    }

    void fetchTrackInfo();
    return () => {
      cancelled = true;
    };
  }, [trackId, accessToken]);

  return trackInfo;
}
