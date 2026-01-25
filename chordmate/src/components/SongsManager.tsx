import SongForm from "./SongForm";
import SongsList from "./SongsList";

export default function SongsManager() {
  return (
    <div className="flex flex-col h-full">
      <SongForm />
      <div className="flex-1 overflow-auto">
        <SongsList />
      </div>
    </div>
  );
}
