import React from "react";
import {useParams} from "react-router-dom";
import {gql} from "@apollo/client";
import {useQuery} from "@apollo/client/react";
import GetSongData from "types/GetSongData";

const GET_SONG = gql`
    query GetSong($id: Int!) {
        song(id: $id) {
            id
            title
            artist
            content
        }
    }
`;

export default function SongDetail() {
    const {id} = useParams<{ id: string }>();
    const {data, loading, error} = useQuery<GetSongData>(GET_SONG, {
        variables: {id: parseInt(id!)},
    });

    if (loading) return <p>Loading...</p>;
    if (error) return <p>Error: {error.message}</p>;
    if (!data?.song) return <p>Song not found</p>;

    const song = data.song;

    return (
        <div>
            <h1>{song.title}</h1>
            <p>Artist: {song.artist}</p>
            <pre>{song.content}</pre>
        </div>
    );
}
