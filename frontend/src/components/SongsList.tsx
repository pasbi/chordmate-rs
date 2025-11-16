import React from "react";
import Song from "types/Song";
import {Link} from "react-router-dom";

export default function SongsList({songs, onDelete}: { songs: Song[], onDelete: (id: number) => void }) {
    return (
        <div className="p-4">
            <h2>🎵 Songs</h2>
            <ul>
                {songs.map(song => (
                    <li key={song.id}>
                        <button onClick={() => onDelete(song.id)}>Delete</button>
                        &nbsp;
                        <Link
                            to={`/songs/${song.id}`}><strong>{song.title || "(untitled)"}</strong> — {song.artist || "unknown"}
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
