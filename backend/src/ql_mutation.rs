use crate::database_connection::DatabaseConnection;
use crate::song::Song;
use juniper::{graphql_object, FieldError, FieldResult, Value};
use tokio_postgres::Error;

pub struct QLMutation {
    pub database_connection: DatabaseConnection,
}

fn expect_1(n: Result<u64, Error>, action: &str) -> FieldResult<bool> {
    match n {
        Ok(n) if n == 1 => Ok(true),
        Ok(n) if n == 0 => Ok(false),
        Ok(n) => Err(FieldError::new(
            format!("Unexpected number of rows {action}: {n}"),
            Value::scalar(n as i32),
        )),
        Err(e) => Err(FieldError::new(
            "Database execution error",
            Value::scalar(e.to_string()),
        )),
    }
}

#[graphql_object]
impl QLMutation {
    async fn add_song(&self, title: String, artist: String) -> FieldResult<Song> {
        let client = self.database_connection.get().await?;
        let statement = client
            .prepare(
                "INSERT INTO songs (title, artist, content, spotify_track) VALUES ($1, $2, '', '') RETURNING *"
            )
            .await
            .expect("SQL query preparation failed.");

        let row = client
            .query_one(&statement, &[&title, &artist])
            .await
            .expect("SQL query failed");

        println!(
            "Inserted song with title: {}, '{}'",
            row.get::<_, String>("title"),
            row.get::<_, String>("spotify_track")
        );

        let song = Song::from_row(&row)?;
        dbg!(&song);
        Ok(song)
    }

    async fn delete_song(&self, id: i32) -> FieldResult<bool> {
        let client = self.database_connection.get().await?;
        let statement = client
            .prepare("DELETE FROM songs WHERE id = $1")
            .await
            .expect("SQL query preparation failed.");
        expect_1(client.execute(&statement, &[&id]).await, "deleted")
    }

    async fn update_song_content(&self, id: i32, content: String) -> FieldResult<bool> {
        let client = self.database_connection.get().await?;
        let statement = client
            .prepare("UPDATE songs SET content = $2 WHERE id = $1 RETURNING id, content;")
            .await
            .expect("SQL query preparation failed.");
        expect_1(
            client.execute(&statement, &[&id, &content]).await,
            "updated",
        )
    }
}
