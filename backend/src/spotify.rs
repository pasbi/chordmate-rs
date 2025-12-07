use base64::engine::general_purpose;
use base64::Engine;
use dotenvy::dotenv;
use reqwest::Client;
use serde::Deserialize;
use std::env;
use std::time::{Duration, Instant};
use thiserror::Error;
use tokio::sync::{Mutex, OnceCell};

#[derive(Deserialize, Debug)]
struct SpotifyTokenResponse {
    access_token: String,
    expires_in: u64,
}

struct CachedToken {
    token: String,
    expires_at: Instant,
}

pub struct SpotifyClient {
    client_id: String,
    client_secret: String,
    token_cache: Mutex<Option<CachedToken>>,
}

#[derive(Error, Debug)]
pub enum SpotifyError {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),
    #[error("Spotify API returned error: {0}")]
    Api(String),
    #[error("Missing access token in response")]
    MissingToken,
}

impl SpotifyClient {
    pub fn new() -> Self {
        dotenv().ok();
        let c = SpotifyClient {
            client_id: env::var("SPOTIFY_CLIENT_ID").expect("SPOTIFY_CLIENT_ID is not set."),
            client_secret: env::var("SPOTIFY_CLIENT_SECRET")
                .expect("SPOTIFY_CLIENT_SECRET is not set"),
            token_cache: Mutex::new(None),
        };
        println!(
            "SPOTIFY_CLIENT_ID: {}, SPOTIFY_CLIENT_SECRET: {}",
            c.client_id, c.client_secret
        );
        c
    }

    async fn request_new_token(&self) -> Result<CachedToken, SpotifyError> {
        let client = Client::new();
        let auth_header =
            general_purpose::STANDARD.encode(format!("{}:{}", self.client_id, self.client_secret));
        let res = client
            .post("https://accounts.spotify.com/api/token")
            .header("Authorization", format!("Basic {}", auth_header))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body("grant_type=client_credentials")
            .send()
            .await
            .expect("Failed to send request");
        if !res.status().is_success() {
            return Err(SpotifyError::Api(format!(
                "Spotify returned status {}: {}",
                res.status(),
                res.text().await.unwrap_or_default(),
            )));
        }
        let token_res: SpotifyTokenResponse = res.json().await?;
        if token_res.access_token.is_empty() {
            return Err(SpotifyError::MissingToken);
        }

        Ok(CachedToken {
            token: token_res.access_token.clone(),
            expires_at: Instant::now() + Duration::from_secs(token_res.expires_in)
                - Duration::from_secs(60),
        })
    }

    pub async fn get_spotify_token(&self) -> Result<String, SpotifyError> {
        {
            let cache = self.token_cache.lock().await;
            if let Some(cached) = &*cache {
                if !cached.token.is_empty() && Instant::now() < cached.expires_at {
                    return Ok(cached.token.clone());
                }
            }
        }

        let new_token = self.request_new_token().await?;
        let mut cache = self.token_cache.lock().await;
        let token = new_token.token.clone();
        *cache = Some(new_token);
        Ok(token)
    }
}
