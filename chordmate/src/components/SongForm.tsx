import { useMutation } from "@apollo/client/react";
import { gql } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import { GET_SONGS } from "../graphql";
import Button from "./Button.tsx";

const ADD_SONG = gql`
  mutation AddSong {
    addSong
  }
`;

interface AddSongData {
  addSong: number;
}

type AddSongVars = object;

export default function SongForm() {
  const [addSong] = useMutation<AddSongData, AddSongVars>(ADD_SONG, {
    onCompleted: (data) => {
      const newId = data.addSong;
      navigate(`/songs/${newId}`);
    },
    refetchQueries: [{ query: GET_SONGS }],
  });
  const navigate = useNavigate();

  return (
    <Button variant="primary" onClick={() => addSong()}>
      Add Song
    </Button>
  );
}
