import { useAccessToken } from "../hooks/useAccessToken";
import { useSpotifyPlayer } from "../hooks/useSpotifyPlayer";

export default function SpotifyPlayer({ trackId }: { trackId: string }) {
  const accessToken = useAccessToken();
  const { player, deviceId } = useSpotifyPlayer(accessToken, trackId);

  return (
    <div>
      <p>Player ready: {player ? "Yes" : "No"}</p>
      <p>Device ID: {deviceId ?? "Waiting..."}</p>
    </div>
  );
}
