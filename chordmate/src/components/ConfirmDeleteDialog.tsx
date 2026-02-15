import { useNavigate, useParams } from "react-router-dom";
import { useMutation } from "@apollo/client/react";
import { DELETE_SONG, GET_SONGS } from "../graphql";
import Button from "./Button.tsx";
import { Modal } from "./Modal.tsx";
import useSong from "../hooks/useSong.ts";
import type Song from "../types/Song.ts";

function labelSong(song?: Song) {
  if (!song) {
    return "Undefined Song";
  }
  if (song.artist.length > 0 || song.title.length > 0) {
    return `${song.title} by ${song.artist}`;
  }

  const cl = song.content.length;
  if (cl > 0) {
    return `Song with content of length ${cl}.`;
  }

  return "Empty Song";
}

export function ConfirmDeleteDialog({ onClose }: { onClose: () => void }) {
  const { id: idString } = useParams<{ id: string }>();
  const id = parseInt(idString!);

  const navigate = useNavigate();
  const [deleteSong] = useMutation(DELETE_SONG);

  const handleConfirm = async () => {
    await deleteSong({
      variables: { id },
      refetchQueries: [{ query: GET_SONGS, variables: {} }],
    });
    navigate("/songs");
  };

  const { song } = useSong(id);

  return (
    <Modal onClose={onClose}>
      <h2 className="text-xl font-semibold mb-2 p-4 text-gray-900 dark:text-gray-100">
        Delete {labelSong(song)}?
      </h2>
      <p>This action cannot be undone.</p>

      <Button variant="danger" onClick={handleConfirm}>
        Delete
      </Button>
      <Button variant="primary" onClick={onClose}>
        Cancel
      </Button>
    </Modal>
  );
}
