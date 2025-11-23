import React from "react";
import {useParams} from "react-router-dom";
import {gql} from "@apollo/client";
import {useMutation, useQuery} from "@apollo/client/react";
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

interface UpdateSongContentData {
    updateSongContent: boolean
}

interface UpdateSongContentVars {
    id: number
    content: string
}

const UPDATE_SONG_CONTENT = gql`
    mutation UpdateSongContent($id: Int!, $content: String!) {
        updateSongContent(id: $id, content: $content),
    }
`


export default function SongDetail() {
    const {id: idString} = useParams<{ id: string }>();
    const id = parseInt(idString!);
    const {data, loading, error} = useQuery<GetSongData>(GET_SONG, {
        variables: {id},
    });
    const [updateSongContent, {loading: saving}] = useMutation<UpdateSongContentData, UpdateSongContentVars>(UPDATE_SONG_CONTENT);
    const [editorContent, setEditorContent] = React.useState<string>('');

    React.useEffect(() => {
        if (data?.song) {
            setEditorContent(data.song.content);
        }
    }, [data?.song?.content])

    if (loading) return <p>Loading...</p>;
    if (error) return <p>Error: {error.message}</p>;
    if (!data?.song) return <p>Song not found</p>;
    const song = data.song;

    const save = async () => {
        console.log("Start saving");
        if (!id) {
            console.log("return early no id");
            return
        }
        console.log(`id=${id}`);

        try {
            console.log(`mutation: id=${id}, content=${editorContent}`);
            await updateSongContent({
                variables: {id, content: editorContent,},
                refetchQueries: [{query: GET_SONG, variables: {id}}],
            })
        } catch (error) {
            console.error(error)
        }

    }


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
            <Editor content={song.content} onUpdate={setEditorContent}/>
        </div>
    );
}
