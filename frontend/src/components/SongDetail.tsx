import React, { useEffect } from "react";
import { useParams } from "react-router-dom";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import GetSongData from "types/GetSongData";
import { Link } from "react-router-dom";
import "./SongDetail.css";
import Editor from "components/Editor";
import SpotifyTrack from "types/SpotifyTrack";
import SpotifySearchModal from "./SpotifySearchModal";
import { SpotifyPlayer } from "../types/global";

const GET_SONG = gql`
  query GetSong($id: Int!) {
    song(id: $id) {
      id
      title
      artist
      content
    }
  }
`;

interface UpdateSongContentData {
  updateSongContent: boolean;
}

interface UpdateSongContentVars {
  id: number;
  content: string;
}

const UPDATE_SONG_CONTENT = gql`
  mutation UpdateSongContent($id: Int!, $content: String!) {
    updateSongContent(id: $id, content: $content)
  }
`;

interface UpdateSongTrackData {
  updateSongTrack: boolean;
}

interface UpdateSongTrackVars {
  id: number;
  track: string;
}

const UPDATE_SONG_TRACK = gql`
  mutation UpdateSongContent($id: Int!, $track: String!) {
    updateSongTrack(id: $id, track: $track)
  }
`;

export default function SongDetail() {
  const { id: idString } = useParams<{ id: string }>();
  const id = parseInt(idString!);
  const { data, loading, error } = useQuery<GetSongData>(GET_SONG, {
    variables: { id },
  });
  const [updateSongContent] = useMutation<
    UpdateSongContentData,
    UpdateSongContentVars
  >(UPDATE_SONG_CONTENT);
  const [updateSongTrack] = useMutation<
    UpdateSongTrackData,
    UpdateSongTrackVars
  >(UPDATE_SONG_TRACK);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editorContent, setEditorContent] = React.useState<string>("");

  React.useEffect(() => {
    if (data?.song) {
      setEditorContent(data.song.content);
    }
  }, [data?.song?.content]);

  const [deviceId, setDeviceId] = React.useState<string | null>(null);
  const [player, setPlayer] = React.useState<SpotifyPlayer | null>(null);
  const [accessToken, setAccessToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    console.log("Getting player...");
    const r = async () => {
      const spotifyApi = await fetch(
        `http://${window.location.hostname}:3000/spotify`,
      ).then((res) => {
        return res.json();
      });

      setAccessToken(spotifyApi.accessToken);
    };
    r();
  }, []);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    window.onSpotifyWebPlaybackSDKReady = async () => {
      setPlayer(
        new Spotify.Player({
          name: "My Web Player",
          getOAuthToken: (cb) => {
            cb(accessToken!); // fetched from your backend
          },
          volume: 0.5,
        }),
      );
    };
    document.body.appendChild(script);
  }, [accessToken]);

  useEffect(() => {
    if (!player) {
      return;
    }
    player.addListener("ready", async ({ deviceId }) => {
      if (deviceId) {
        console.log("Ready with new Device ID", deviceId);
        setDeviceId(deviceId);
        return;
      }
      console.log("didn't get a new device id. recycling old one...");
      const res = await fetch("https://api.spotify.com/v1/me/player/devices", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const devices = data.devices;
      console.log(
        `old device ids ${devices.length}`,
        JSON.stringify(devices, null, 2),
      );
      if (devices.length > 0) {
        console.log("Ready with old Device ID", devices[0].id);
        setDeviceId(devices[0].id);
      }
    });

    player.addListener("not_ready", ({ deviceId }) => {
      console.log("Device ID has gone offline", deviceId);
    });
    player!.connect();
  }, [player]);

  useEffect(() => {
    if (!player || !accessToken || !deviceId) {
      console.log("Attempt to play aborted.");
      return;
    }
    console.log("Attempting to play...");

    const playTrack = async (trackUri: string) => {
      await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uris: [trackUri] }),
        },
      );
    };

    playTrack("spotify:track:3z8h0TU7ReDPLIbEnYhWZb");
  }, [deviceId, player, accessToken]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  if (!data?.song) return <p>Song not found</p>;
  const song = data.song;

  const save = async () => {
    console.log("Start saving");
    if (!id) {
      console.log("return early no id");
      return;
    }
    console.log(`id=${id}`);

    try {
      console.log(`mutation: id=${id}, content=${editorContent}`);
      await updateSongContent({
        variables: { id, content: editorContent },
        refetchQueries: [{ query: GET_SONG, variables: { id } }],
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleOpenModal = () => setModalOpen(true);
  const handleCloseModal = () => setModalOpen(false);

  const handleTrackSelected = (track: SpotifyTrack) => {
    console.log(`Selected: ${JSON.stringify(track)}`);
    updateSongTrack({ variables: { id: song.id, track: track.id } });
    handleCloseModal();
  };

  return (
    <div className="song-detail-container">
      <header>
        <h1>{song.title}</h1>
        <div>Artist: {song.artist}</div>
        <div>
          <Link to={"/"}>Back </Link>
        </div>
        <div>
          <button onClick={save}>Save</button>
        </div>
        <button onClick={handleOpenModal}>Link Spotify Track</button>
        {modalOpen && (
          <SpotifySearchModal
            initialQuery={`${song.title} ${song.artist}`}
            onSelect={handleTrackSelected}
            onClose={handleCloseModal}
          />
        )}
      </header>
      <Editor content={song.content} onUpdate={setEditorContent} />
    </div>
  );
}
