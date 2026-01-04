import { GraphQLError } from "graphql/error";

export default async function startSpotifyOauthFlow(currentPath: string) {
  const spotifyApi = await fetch(
    `http://${window.location.hostname}:3000/spotify`,
  ).then((res) => res.json());

  console.log(JSON.stringify(spotifyApi));

  const scope = encodeURIComponent(
    "streaming user-read-private user-read-email user-modify-playback-state user-read-playback-state",
  );

  const state = encodeURIComponent(currentPath);
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${spotifyApi.clientId}&response_type=code&redirect_uri=${spotifyApi.redirectUri}&scope=${scope}&state=${state}`;
  window.location.href = authUrl;
}
