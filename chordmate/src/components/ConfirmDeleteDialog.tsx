import { useNavigate, useParams } from "react-router-dom";
import { useMutation } from "@apollo/client/react";
import { DELETE_SONG, GET_SONGS } from "../graphql";

export function ConfirmDeleteDialog() {
  const { id: idString } = useParams<{ id: string }>();
  const id = parseInt(idString!);

  const navigate = useNavigate();
  const [deleteSong] = useMutation(DELETE_SONG);

  const handleConfirm = async () => {
    await deleteSong({
      variables: { id },
      refetchQueries: [{ query: GET_SONGS, variables: {} }],
    });
    navigate("/songs", { replace: true });
  };

  return (
    <div className="backdrop">
      <div className="dialog">
        <h2>Delete item?</h2>
        <p>This action cannot be undone.</p>

        <button onClick={handleConfirm}>Delete</button>
        <button onClick={() => navigate(-1)}>Cancel</button>
      </div>
    </div>
  );
}
