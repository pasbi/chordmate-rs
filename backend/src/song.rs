use juniper::GraphQLObject;
use tokio_postgres::Row;

#[derive(GraphQLObject, Clone, Debug)]
pub struct Song {
    pub id: i32,
    pub title: String,
    pub artist: String,
    pub spotify_track: String,
    pub content: String,
}

impl Song {
    pub fn from_row(row: &Row) -> Song {
        Song {
            id: row.get("id"),
            title: row.get("title"),
            artist: row.get("artist"),
            spotify_track: row.get("spotify_track"),
            content: row.get("content"),
        }
    }
}
