import React from "react";
import Song from "types/Song";

export default function SongsList({songs, onDelete}: { songs: Song[], onDelete: (id: number) => void }) {
    return (
        <div className="p-4">
            <h2>🎵 Songs</h2>
            <ul>
                {songs.map(song => (
                    <li key={song.id}>
                        <button onClick={() => onDelete(song.id)}>Delete</button>
                        &nbsp;
                        <strong>{song.title || "(untitled)"}</strong> — {song.artist || "unknown"}
                    </li>
                ))}
            </ul>
        </div>
    );
}
