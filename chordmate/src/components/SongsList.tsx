import type Song from "../types/Song";
import { useQuery } from "@apollo/client/react";
import type GetSongsData from "../types/GetSongsData";
import { GET_SONGS } from "../graphql";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type SortField = "id" | "title" | "artist";

export default function SongsList() {
  const { data, loading, error } = useQuery<GetSongsData>(GET_SONGS);

  const [filter, setFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("id");
  const [sortAsc, setSortAsc] = useState(true);
  const navigate = useNavigate();

  const displayedSongs = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.songs
      .filter((song: Song) =>
        [song.title, song.artist].some((v) => v.toLowerCase().includes(filter.toLowerCase()))
      )
      .sort((a: Song, b: Song) => {
        const valA = a[sortField];
        const valB = b[sortField];
        const f = sortAsc ? 1 : -1;
        if (typeof valA === "string" && typeof valB === "string") {
          return f * valA.toLowerCase().localeCompare(valB.toLowerCase());
        }
        if (typeof valA === "number" && typeof valB === "number") {
          return f * (valA - valB);
        }
        return 0;
      });
  }, [data, filter, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  if (loading) return <p>Loading songs...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div className="w-full px-3 sm:px-4 md:max-w-xl md:mx-auto">
      <input
        type="text"
        placeholder="Search by title, artist, or ID"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full p-2 mb-4 border rounded"
      />
      <div className="flex-1 overflow-x-auto">
        <table className="min-w-125 w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-blue-200 dark:bg-blue-950">
            <tr className="border-b">
              <th className="p-2">Icon</th>
              <th className="p-2 cursor-pointer text-left" onClick={() => handleSort("title")}>
                Title {sortField === "title" ? (sortAsc ? "↑" : "↓") : ""}
              </th>
              <th className="p-2 cursor-pointer text-left" onClick={() => handleSort("artist")}>
                Artist {sortField === "artist" ? (sortAsc ? "↑" : "↓") : ""}
              </th>
              <th className="p-2 cursor-pointer text-left" onClick={() => handleSort("id")}>
                ID {sortField === "id" ? (sortAsc ? "↑" : "↓") : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedSongs.map((song) => (
              <tr
                key={song.id}
                className="border-b hover:bg-gray-50 dark:hover:bg-blue-900"
                onClick={() => navigate(`${song.id}`)}
              >
                <td>
                  <img
                    className="w-16"
                    src={song.albumArtUrl ?? undefined}
                    alt={song.albumArtUrl ?? "/"}
                  ></img>
                </td>
                <td className="p-2">{song.title}</td>
                <td className="p-2">{song.artist}</td>
                <td className="p-2">{song.id}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {displayedSongs.length === 0 && <p className="text-center py-4">No songs found</p>}
      </div>
    </div>
  );
}
