use crate::database_connection::DatabaseConnection;
use crate::song::Song;
use crate::spotify::SpotifyClient;
use crate::spotify_track::SpotifyTrack;
use juniper::{graphql_object, FieldResult};
use std::sync::Arc;
use tokio_postgres::Row;

pub struct QLQuery {
    pub database_connection: DatabaseConnection,
    pub spotify_client: Arc<SpotifyClient>,
}

#[graphql_object]
impl QLQuery {
    pub async fn songs(&self) -> FieldResult<Vec<Song>> {
        let client = self.database_connection.get().await;
        let statement = client
            .prepare("SELECT id, title, artist, spotify_track, content FROM songs")
            .await
            .expect("SQL query preparation failed");

        let rows: Vec<Row> = client
            .query(&statement, &[])
            .await
            .expect("SQL query failed");

        let songs: Vec<Song> = rows.iter().map(Song::from_row).collect();
        Ok(songs)
    }
    async fn song(&self, id: i32) -> Option<Song> {
        let client = self.database_connection.get().await;
        let statement = client
            .prepare("SELECT * FROM songs WHERE id = $1")
            .await
            .unwrap();
        let row = client.query_opt(&statement, &[&id]).await.unwrap();
        row.as_ref().map(Song::from_row)
    }

    async fn search_spotify_tracks(&self, query: String) -> FieldResult<Vec<SpotifyTrack>> {
        let json = self
            .spotify_client
            .search_tracks(&query)
            .await
            .map_err(|e| {
                juniper::FieldError::new("Spotify API error", juniper::Value::scalar(e.to_string()))
            })?;

        let tracks = json["tracks"]["items"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|item| {
                Some(SpotifyTrack {
                    id: item["id"].as_str()?.to_string(),
                    name: item["name"].as_str()?.to_string(),
                    artists: item["artists"]
                        .as_array()?
                        .iter()
                        .filter_map(|a| a["name"].as_str().map(String::from))
                        .collect(),
                    preview_url: item
                        .get("preview_url")
                        .and_then(|v| v.as_str().map(String::from)),
                    album_art: item
                        .get("album")
                        .and_then(|album| album.get("images"))
                        .and_then(|images| images.as_array()?.get(0))
                        .and_then(|img| img.get("url"))
                        .and_then(|v| v.as_str().map(String::from)),
                })
            })
            .collect();
        Ok(tracks)
    }
}
