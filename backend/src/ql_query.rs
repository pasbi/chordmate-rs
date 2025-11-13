use crate::database_connection::DatabaseConnection;
use crate::song::Song;
use juniper::{graphql_object, FieldResult};

pub struct QLQuery {
    pub database_connection: DatabaseConnection,
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
    pub async fn songs() -> FieldResult<Vec<Song>> {
        let songs = vec![Song {
            id: 0,
            title: "Foo".to_string(),
            artist: "Bar".to_string(),
            spotify_track_id: "frhiu".to_string(),
            content: "Hello Song".to_string(),
        }];
        Ok(songs)
    }
}
