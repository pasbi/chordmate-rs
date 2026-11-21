use juniper::GraphQLObject;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio_postgres::{Error, Row};

#[derive(GraphQLObject, Clone, Debug)]
pub struct Song {
    pub id: i32,
    pub title: String,
    pub artist: String,
    pub spotify_track: String,
    pub content: String,
    pub album_art_url: Option<String>,
    pub bpm: Option<f64>,
    /// Semitones the chords are shifted by when shown; the content stays as written.
    pub transpose: i32,
    /// How the chords write black-key notes: "common", "sharps" or "flats".
    pub spelling: String,
    /// When the song's page was last opened, in milliseconds since the Unix epoch; null if never.
    pub last_viewed_ms: Option<f64>,
}

fn unix_milliseconds(time: SystemTime) -> f64 {
    time.duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs_f64() * 1000.0)
        .unwrap_or(0.0)
}

impl Song {
    pub fn from_row(row: &Row) -> Result<Song, Error> {
        Ok(Song {
            id: row.try_get("id")?,
            title: row.try_get("title")?,
            artist: row.try_get("artist")?,
            spotify_track: row.try_get("spotify_track")?,
            content: row.try_get("content")?,
            album_art_url: row.try_get("album_art_url")?,
            bpm: row.try_get("bpm")?,
            transpose: row.try_get("transpose")?,
            spelling: row.try_get("spelling")?,
            last_viewed_ms: row
                .try_get::<_, Option<SystemTime>>("last_viewed_at")?
                .map(unix_milliseconds),
        })
    }
}
