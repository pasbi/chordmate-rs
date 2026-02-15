use crate::database_connection::DatabaseConnection;
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
            .await
            .expect("SQL query preparation failed.");

        let row = client
            .query_one(&statement, &[])
            .await
            .expect("SQL query failed");

        let id: i32 = row.try_get("id")?;
        Ok(id)
    }

    async fn delete_song(&self, id: i32) -> FieldResult<bool> {
        let client = self.database_connection.get().await?;
        let statement = client
            .prepare("DELETE FROM songs WHERE id = $1;")
            .await
            .expect("SQL query preparation failed.");
        client.execute(&statement, &[&id]).await?;
        Ok(true)
    }

    async fn update_song_content(&self, id: i32, content: String) -> FieldResult<i32> {
        let client = self.database_connection.get().await?;
        let statement = client
            .prepare("UPDATE songs SET content = $2 WHERE id = $1 RETURNING id;")
            .await
            .expect("SQL query preparation failed.");
        let row = client.query_one(&statement, &[&id, &content]).await?;
        Ok(row.try_get("id")?)
    }

    async fn update_song_track(&self, id: i32, track: String) -> FieldResult<i32> {
        let client = self.database_connection.get().await?;
        let statement = client
            .prepare("UPDATE songs SET spotify_track = $2 WHERE id = $1 RETURNING id;")
            .await
            .expect("SQL query preparation failed.");
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
            .await
            .expect("SQL query preparation failed.");
        info!("Statement: {:?}, {:?}", statement, bpm);
        let row = client
            .query_one(&statement, &[&id, &title, &artist, &album_art_url, &bpm])
            .await?;
        Ok(row.try_get("id")?)
    }
}
