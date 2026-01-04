use crate::database_connection::DatabaseConnection;
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

    async fn update_song_meta(&self, id: i32, title: String, artist: String) -> FieldResult<i32> {
        let client = self.database_connection.get().await?;
        let statement = client
            .prepare("UPDATE songs SET title = $2, artist = $3 WHERE id = $1 RETURNING id;")
            .await
            .expect("SQL query preparation failed.");
        let row = client
            .query_one(&statement, &[&id, &title, &artist])
            .await?;
        Ok(row.try_get("id")?)
    }
}
