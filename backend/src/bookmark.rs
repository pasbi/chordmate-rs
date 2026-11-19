use juniper::GraphQLObject;
use tokio_postgres::{Error, Row};

/// A position in a song's Spotify track to jump back to while practicing, and optionally an end
/// point: then the passage up to it is played again and again.
#[derive(GraphQLObject, Clone, Debug)]
pub struct Bookmark {
    pub id: i32,
    pub song_id: i32,
    pub spotify_track: String,
    pub position_ms: i32,
    pub label: String,
    pub end_ms: Option<i32>,
}

impl Bookmark {
    pub fn from_row(row: &Row) -> Result<Bookmark, Error> {
        Ok(Bookmark {
            id: row.try_get("id")?,
            song_id: row.try_get("song_id")?,
            spotify_track: row.try_get("spotify_track")?,
            position_ms: row.try_get("position_ms")?,
            label: row.try_get("label")?,
            end_ms: row.try_get("end_ms")?,
        })
    }
}
