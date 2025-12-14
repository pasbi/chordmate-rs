use juniper::GraphQLObject;
use tokio_postgres::{Error, Row};

#[derive(GraphQLObject, Clone, Debug)]
pub struct Song {
    pub id: i32,
    pub title: String,
    pub artist: String,
    pub spotify_track: String,
    pub content: String,
}

impl Song {
    pub fn from_row(row: &Row) -> Result<Song, Error> {
        Ok(Song {
            id: row.try_get("id")?,
            title: row.try_get("title")?,
            artist: row.try_get("artist")?,
            spotify_track: row.try_get("spotify_track")?,
            content: row.try_get("content")?,
        })
    }
}
