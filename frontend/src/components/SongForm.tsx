import React, {useState} from "react";

export default function SongForm({onSongAdded}: { onSongAdded: (title: string, artist: string) => void }) {
    const [title, setTitle] = useState("");
    const [artist, setArtist] = useState("");
    return (
        <form>
            <input
                type="text"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
            />
            <input
                type="text"
                placeholder="Artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                required
            />
            <button onClick={() => onSongAdded(title, artist)}>
                Add Song
            </button>
        </form>
    );
}

