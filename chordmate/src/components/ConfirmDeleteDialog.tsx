import { useMutation } from "@apollo/client/react";
import { DELETE_SONG, GET_SONGS } from "../graphql";
import Button from "./Button.tsx";
import { Modal } from "./Modal.tsx";
import type Song from "../types/Song.ts";

type SongToDelete = Pick<Song, "id" | "title" | "artist">;

function labelSong(song: SongToDelete) {
  const title = `“${song.title || "Untitled"}”`;
  return song.artist.length > 0 ? `${title} by ${song.artist}` : title;
}

export function ConfirmDeleteDialog({
  song,
  onClose,
}: {
  song: SongToDelete;
  onClose: () => void;
}) {
  const [deleteSong] = useMutation(DELETE_SONG);

  const handleConfirm = async () => {
    await deleteSong({
      variables: { id: song.id },
      refetchQueries: [{ query: GET_SONGS, variables: {} }],
    });
    onClose();
  };

  return (
    <Modal label="Delete song" onClose={onClose}>
      <div className="p-4 flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Delete {labelSong(song)}?</h2>
        <p className="text-gray-700 dark:text-gray-300">This cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
}
