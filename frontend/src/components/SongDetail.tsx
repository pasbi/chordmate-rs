import React from "react";
import {useParams} from "react-router-dom";
import {gql} from "@apollo/client";
import {useQuery} from "@apollo/client/react";
import GetSongData from "types/GetSongData";
import {Link} from "react-router-dom";
import './SongDetail.css'
import Editor from "components/Editor";

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

function save() {
    console.log("save");
}

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
        <div className="song-detail-container">
            <header>
                <h1>{song.title}</h1>
                <div>Artist: {song.artist}</div>
                <div><Link to={"/"}>Back </Link></div>
                <div>
                    <button onClick={save}>Save</button>
                </div>
            </header>
            <Editor content={song.content}/>
        </div>
    );
}
