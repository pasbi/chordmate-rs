const LOOPBACK_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

/**
 * Spotify only accepts plain-HTTP redirect URIs on loopback addresses, so the login can only
 * complete in a browser running on the server machine. Other devices use the token obtained there.
 */
export function isOnServerMachine() {
  return LOOPBACK_HOSTNAMES.includes(window.location.hostname);
}

export default async function startSpotifyOauthFlow(currentPath: string) {
  if (!isOnServerMachine()) {
    console.warn("Spotify login required. Log in on the machine running the Chordmate server.");
    return;
  }

  const spotifyApi = await fetch(`http://${window.location.hostname}:3000/spotify`).then((res) =>
    res.json()
  );

  const scope = encodeURIComponent(
    "streaming user-read-private user-read-email user-modify-playback-state user-read-playback-state"
  );

  const state = encodeURIComponent(currentPath);
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${spotifyApi.clientId}&response_type=code&redirect_uri=${spotifyApi.redirectUri}&scope=${scope}&state=${state}`;
  window.location.href = authUrl;
}
