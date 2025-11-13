use crate::database_connection::DatabaseConnection;
use crate::song::Song;
use juniper::{graphql_object, FieldResult};
use tokio_postgres::Row;

pub struct QLQuery {
    pub database_connection: DatabaseConnection,
}

fn row_to_song(row: &Row) -> Song {
    Song {
        id: row.get("id"),
        title: row.get("title"),
        artist: row.get("artist"),
        spotify_track_id: "frhiu".to_string(),
        content: "Hello Song".to_string(),
    }
}

#[graphql_object]
impl QLQuery {
    /// Adds two `a` and `b` numbers.
    fn add(a: i32, b: i32) -> i32 {
        a + b * 2
    }

    /// Tests the database.
    async fn testdb(&self, key: String, q: String) -> String {
        println!("Start query: {}", q);
        self.database_connection
            .query(&q)
            .await
            .unwrap_or_else(|e| panic!("Internal error: {}", e))
            .and_then(|row| row.try_get(key.as_str()))
            .unwrap_or_else(|e| format!("XError: {}", e))
    }

    pub async fn songs(&self) -> FieldResult<Vec<Song>> {
        let client = self.database_connection.get().await;
        let statement = client
            .prepare("SELECT id, title, artist FROM songs")
            .await
            .expect("SQL query preparation failed");

        let rows: Vec<Row> = client
            .query(&statement, &[])
            .await
            .expect("SQL query failed");

        for row in &rows {
            println!("{}", row.get::<_, String>("title"))
        }

        let songs: Vec<Song> = rows.iter().map(row_to_song).collect();
        Ok(songs)
    }
}
