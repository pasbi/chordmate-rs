import { describe, it, expect } from "vitest";
import {
  describeSpotifyFailure,
  type PlaybackState,
  playsTrack,
  SpotifyApiError,
} from "./spotifyApi";

function stateOf(trackUri: string, linkedFromUri: string | null): PlaybackState {
  return {
    deviceId: "device",
    paused: false,
    position: 0,
    duration: 1000,
    trackUri,
    linkedFromUri,
    trackName: "Track",
  };
}

describe("playsTrack", () => {
  it("matches the track being played", () => {
    expect(playsTrack(stateOf("spotify:track:a", null), "spotify:track:a", null)).toBe(true);
  });

  it("matches a withdrawn track that Spotify replaced on request", () => {
    const replacement = stateOf("spotify:track:new", "spotify:track:withdrawn");
    expect(playsTrack(replacement, "spotify:track:withdrawn", null)).toBe(true);
  });

  it("matches the known replacement when it is played directly", () => {
    const direct = stateOf("spotify:track:new", null);
    expect(playsTrack(direct, "spotify:track:withdrawn", "spotify:track:new")).toBe(true);
  });

  it("doesn't match another track", () => {
    expect(playsTrack(stateOf("spotify:track:a", null), "spotify:track:b", null)).toBe(false);
    expect(playsTrack(stateOf("spotify:track:a", "spotify:track:c"), "spotify:track:b", null)).toBe(
      false
    );
    expect(playsTrack(stateOf("spotify:track:a", null), "spotify:track:b", "spotify:track:c")).toBe(
      false
    );
  });

  it("doesn't match when nothing plays", () => {
    expect(playsTrack(null, "spotify:track:a", null)).toBe(false);
  });
});

describe("describeSpotifyFailure", () => {
  it("uses Spotify's own message", () => {
    const body =
      '{"error":{"status":404,"message":"Device not found","reason":"NO_ACTIVE_DEVICE"}}';
    const err = new SpotifyApiError("PUT", "/me/player/play", 404, body);
    expect(describeSpotifyFailure(err)).toBe("Device not found");
  });

  it("falls back to the status without a message", () => {
    const err = new SpotifyApiError("PUT", "/me/player/play", 502, "<html>Bad gateway</html>");
    expect(describeSpotifyFailure(err)).toBe("error 502");
  });

  it("reports a failed network as unreachable", () => {
    expect(describeSpotifyFailure(new TypeError("NetworkError"))).toBe("Spotify can't be reached");
  });
});
