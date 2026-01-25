import type Song from "../types/Song";
import { useQuery } from "@apollo/client/react";
import type GetSongsData from "../types/GetSongsData";
import { GET_SONGS } from "../graphql";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

type SortField = "id" | "title" | "artist";

export default function SongsList() {
  const { data, loading, error } = useQuery<GetSongsData>(GET_SONGS);

  const [filter, setFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("id");
  const [sortAsc, setSortAsc] = useState(true);

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
    <div className="max-w-xl mx-auto p-4">
      <input
        type="text"
        placeholder="Search by title, artist, or ID"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full p-2 mb-4 border rounded"
      />

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="p-2">Icon</th>
            <th className="p-2 cursor-pointer" onClick={() => handleSort("title")}>
              Title {sortField === "title" ? (sortAsc ? "↑" : "↓") : ""}
            </th>
            <th className="p-2 cursor-pointer" onClick={() => handleSort("artist")}>
              Artist {sortField === "artist" ? (sortAsc ? "↑" : "↓") : ""}
            </th>
            <th className="p-2 cursor-pointer" onClick={() => handleSort("id")}>
              ID {sortField === "id" ? (sortAsc ? "↑" : "↓") : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          {displayedSongs.map((song) => (
            <tr key={song.id} className="border-b hover:bg-gray-50">
              <td>AA</td>
              <td className="p-2">
                <Link to={`${song.id}`}>{song.title}</Link>
              </td>
              <td className="p-2">
                <Link to={`${song.id}`}>{song.artist}</Link>
              </td>
              <td className="p-2">
                <Link to={`${song.id}`}>{song.id}</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {displayedSongs.length === 0 && <p className="text-center py-4">No songs found</p>}
    </div>
  );
}
