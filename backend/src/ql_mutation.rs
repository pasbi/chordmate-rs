use crate::database_connection::DatabaseConnection;
use crate::song::Song;
use juniper::graphql_object;

pub struct QLMutation {
    pub database_connection: DatabaseConnection,
}

#[graphql_object]
impl QLMutation {
    async fn add_song(&self, title: String, artist: String) -> Song {
        let client = self.database_connection.get().await;
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

        let song = Song::from_row(&row);
        dbg!(&song);
        song
    }

    async fn delete_song(&self, id: i32) -> bool {
        let client = self.database_connection.get().await;
        let statement = client
            .prepare("DELETE FROM songs WHERE id = $1")
            .await
            .expect("SQL query preparation failed.");
        match client.execute(&statement, &[&id]).await {
            Ok(n) if n > 0 => true,
            _ => false,
        }
    }

    async fn update_song_content(&self, id: i32, content: String) -> bool {
        let client = self.database_connection.get().await;
        let statement = client
            .prepare("UPDATE songs SET content = $2 WHERE id = $1 RETURNING id, content;")
            .await
            .expect("SQL query preparation failed.");
        match client.execute(&statement, &[&id, &content]).await {
            Ok(n) if n == 1 => true,
            _ => false,
        }
    }
}
