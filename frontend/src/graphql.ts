import {gql} from '@apollo/client';

export const GET_SONGS = gql`
    query GetSongs {
        songs {
            id
            title
            artist
            spotifyTrack
        }
    }
`;

export const ADD_SONG = gql`
    mutation AddSong($title: String, $artist: String, $spotifyTrack: String) {
        addSong(title: $title, artist: $artist, spotifyTrack: $spotifyTrack) {
            id
            title
            artist
            spotifyTrack
        }
    }
`;

