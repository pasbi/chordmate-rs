import { useMutation } from "@apollo/client/react";
import { gql } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import { GET_SONGS } from "../graphql";

const ADD_SONG = gql`
  mutation AddSong {
    addSong
  }
`;

interface AddSongData {
  addSong: number;
}

interface AddSongVars {}

export default function SongForm() {
  const [addSong] = useMutation<AddSongData, AddSongVars>(ADD_SONG, {
    onCompleted: (data) => {
      const newId = data.addSong;
      navigate(`/songs/${newId}?init=true`);
    },
    refetchQueries: [{ query: GET_SONGS }],
  });
  const navigate = useNavigate();

  return (
    <div>
      <button
        onClick={() => {
          addSong();
        }}
      >
        Add Song
      </button>
    </div>
  );
}
