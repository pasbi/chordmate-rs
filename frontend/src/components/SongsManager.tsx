import React, {useEffect, useState} from "react";
import Song from "types/Song";
import {useMutation, useQuery} from "@apollo/client/react";
import {gql} from "@apollo/client";
import SongForm from "components/SongForm";
import SongsList from "components/SongsList";
import GetSongsData from "types/GetSongsData";


const GET_SONGS = gql`
    query GetSongs {
        songs {
            id
            title
            artist
        }
    }`;

const ADD_SONG = gql`
    mutation AddSong($title: String!, $artist: String!) {
        addSong(title: $title, artist: $artist ) {
            id
            title
            artist
        }
    }
`

const DELETE_SONG = gql`
    mutation DeleteSong($id: Int!) {
        deleteSong(id: $id)
    }
`;

interface AddSongData {
    addSong: Song;
}

interface AddSongVars {
    title: string;
    artist: string;
}


export default function SongsManager() {
    const [songs, setSongs] = useState<Song[]>([]);
    const {data, loading, error} = useQuery<GetSongsData>(GET_SONGS);
    const [deleteSong] = useMutation(DELETE_SONG);
    const [addSong] = useMutation<AddSongData, AddSongVars>(ADD_SONG);

    useEffect(() => {
        if (data?.songs) {
            setSongs(data.songs);
        }
    }, [data]);

    if (loading) return <p>Loading songs...</p>;
    if (error) return <p>Error: {error.message}</p>;
    if (!data) return <p>No data available</p>;

    const handleDelete = async (id: number) => {
        try {
            await deleteSong({variables: {id}});
            setSongs(prev => prev.filter(song => song.id !== id));
        } catch (err) {
            console.error("Failed to delete song:", err);
        }
    };

    const handleSubmit = async (title: string, artist: string) => {
        const {data} = await addSong({variables: {title, artist}});
        if (data?.addSong) {
            setSongs(prev => [...prev, data.addSong]);
        }
    };

    return (
        <div>
            <SongForm onSongAdded={handleSubmit}/>
            <SongsList songs={songs} onDelete={handleDelete}/>
        </div>
    )

}

