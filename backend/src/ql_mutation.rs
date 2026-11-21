use crate::bookmark::Bookmark;
use crate::database_connection::DatabaseConnection;
use crate::section_anchor::SectionAnchor;
use crate::song::Song;
use juniper::{graphql_object, FieldResult};

use log::info;

pub struct QLMutation {
    pub database_connection: DatabaseConnection,
}

#[graphql_object]
impl QLMutation {
    async fn add_song(&self) -> FieldResult<i32> {
        let client = self.database_connection.get().await?;
        let statement = client
            .prepare(
                "INSERT INTO songs (title, artist, content, spotify_track) VALUES ('', '', '', '') RETURNING id"
            )
            .await?;

        let row = client.query_one(&statement, &[]).await?;

        let id: i32 = row.try_get("id")?;
        Ok(id)
    }

    async fn delete_song(&self, id: i32) -> FieldResult<bool> {
        let client = self.database_connection.get().await?;
        let statement = client.prepare("DELETE FROM songs WHERE id = $1;").await?;
        client.execute(&statement, &[&id]).await?;
        Ok(true)
    }

    async fn update_song_content(&self, id: i32, content: String) -> FieldResult<i32> {
        let client = self.database_connection.get().await?;
        let statement = client
            .prepare("UPDATE songs SET content = $2 WHERE id = $1 RETURNING id;")
            .await?;
        let row = client.query_one(&statement, &[&id, &content]).await?;
        Ok(row.try_get("id")?)
    }

    async fn update_song_track(&self, id: i32, track: String) -> FieldResult<i32> {
        let client = self.database_connection.get().await?;
        let statement = client
            .prepare("UPDATE songs SET spotify_track = $2 WHERE id = $1 RETURNING id;")
            .await?;
        let row = client.query_one(&statement, &[&id, &track]).await?;
        Ok(row.try_get("id")?)
    }

    async fn update_song_meta(
        &self,
        id: i32,
        title: String,
        artist: String,
        album_art_url: Option<String>,
        bpm: Option<f64>,
    ) -> FieldResult<i32> {
        let client = self.database_connection.get().await?;
        let statement = client
            .prepare("UPDATE songs SET title = $2, artist = $3, album_art_url = $4, bpm = $5 WHERE id = $1 RETURNING id;")
            .await?;
        info!("Statement: {:?}, {:?}", statement, bpm);
        let row = client
            .query_one(&statement, &[&id, &title, &artist, &album_art_url, &bpm])
            .await?;
        Ok(row.try_get("id")?)
    }

    /// Sets how the song's chords write black-key notes: "common", "sharps" or "flats".
    async fn update_song_spelling(&self, id: i32, spelling: String) -> FieldResult<Song> {
        let client = self.database_connection.get().await?;
        let statement = client
            .prepare("UPDATE songs SET spelling = $2 WHERE id = $1 RETURNING *;")
            .await?;
        let row = client.query_one(&statement, &[&id, &spelling]).await?;
        Ok(Song::from_row(&row)?)
    }

    /// Records that the song's page was opened now.
    async fn mark_song_viewed(&self, id: i32) -> FieldResult<Song> {
        let client = self.database_connection.get().await?;
        let statement = client
            .prepare("UPDATE songs SET last_viewed_at = now() WHERE id = $1 RETURNING *;")
            .await?;
        let row = client.query_one(&statement, &[&id]).await?;
        Ok(Song::from_row(&row)?)
    }

    /// Sets the semitones the song's chords are shifted by when shown.
    async fn update_song_transpose(&self, id: i32, transpose: i32) -> FieldResult<Song> {
        let client = self.database_connection.get().await?;
        let statement = client
            .prepare("UPDATE songs SET transpose = $2 WHERE id = $1 RETURNING *;")
            .await?;
        let row = client.query_one(&statement, &[&id, &transpose]).await?;
        Ok(Song::from_row(&row)?)
    }

    /// Anchors a section at a position, replacing its earlier anchor if it had one.
    async fn set_section_anchor(
        &self,
        song_id: i32,
        spotify_track: String,
        heading: String,
        occurrence: i32,
        position_ms: i32,
    ) -> FieldResult<SectionAnchor> {
        let client = self.database_connection.get().await?;
        let statement = client
            .prepare(
                "INSERT INTO section_anchors \
                 (song_id, spotify_track, heading, occurrence, position_ms) \
                 VALUES ($1, $2, $3, $4, $5) \
                 ON CONFLICT (song_id, spotify_track, heading, occurrence) \
                 DO UPDATE SET position_ms = EXCLUDED.position_ms RETURNING *;",
            )
            .await?;
        let row = client
            .query_one(
                &statement,
                &[
                    &song_id,
                    &spotify_track,
                    &heading,
                    &occurrence,
                    &position_ms,
                ],
            )
            .await?;
        Ok(SectionAnchor::from_row(&row)?)
    }

    async fn delete_section_anchor(&self, id: i32) -> FieldResult<bool> {
        let client = self.database_connection.get().await?;
        let statement = client
            .prepare("DELETE FROM section_anchors WHERE id = $1;")
            .await?;
        client.execute(&statement, &[&id]).await?;
        Ok(true)
    }

    async fn add_bookmark(
        &self,
        song_id: i32,
        spotify_track: String,
        position_ms: i32,
        label: String,
        end_ms: Option<i32>,
    ) -> FieldResult<Bookmark> {
        let client = self.database_connection.get().await?;
        let statement = client
            .prepare(
                "INSERT INTO bookmarks (song_id, spotify_track, position_ms, label, end_ms) \
                 VALUES ($1, $2, $3, $4, $5) RETURNING *;",
            )
            .await?;
        let row = client
            .query_one(
                &statement,
                &[&song_id, &spotify_track, &position_ms, &label, &end_ms],
            )
            .await?;
        Ok(Bookmark::from_row(&row)?)
    }

    async fn update_bookmark(
        &self,
        id: i32,
        position_ms: i32,
        label: String,
        end_ms: Option<i32>,
    ) -> FieldResult<Bookmark> {
        let client = self.database_connection.get().await?;
        let statement = client
            .prepare(
                "UPDATE bookmarks SET position_ms = $2, label = $3, end_ms = $4 \
                 WHERE id = $1 RETURNING *;",
            )
            .await?;
        let row = client
            .query_one(&statement, &[&id, &position_ms, &label, &end_ms])
            .await?;
        Ok(Bookmark::from_row(&row)?)
    }

    async fn delete_bookmark(&self, id: i32) -> FieldResult<bool> {
        let client = self.database_connection.get().await?;
        let statement = client
            .prepare("DELETE FROM bookmarks WHERE id = $1;")
            .await?;
        client.execute(&statement, &[&id]).await?;
        Ok(true)
    }
}
