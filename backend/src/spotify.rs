use juniper::{graphql_value, FieldError, FieldResult};
use log::info;
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;
use std::env;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: String,
    token_type: String,
    expires_in: u64,
    scope: String,
}

struct StoredToken {
    access_token: String,
    refresh_token: String,
    token_type: String,
    expires_at: Instant,
    scope: String,
}
pub struct SpotifyClient {
    token_cache: Mutex<Option<StoredToken>>,
    client_id: String,
    client_secret: String,
    redirect_uri: String,
}

#[derive(Deserialize)]
struct TokenErrorResponse {
    error: String,
    error_description: String,
}

#[derive(Debug)]
pub enum TokenError {
    Missing,
    FailedToGet(String),
}

impl From<TokenError> for FieldError {
    fn from(err: TokenError) -> Self {
        match err {
            TokenError::Missing => FieldError::new(
                "User is not authenticated",
                graphql_value!({"code": "UNAUTHENTICATED"}),
            ),
            TokenError::FailedToGet(message) => FieldError::new(
                format!("Failed to get token: {message}"),
                graphql_value!({"code": "TOKEN_ERROR"}),
            ),
        }
    }
}

impl SpotifyClient {
    pub fn new() -> Self {
        let client = SpotifyClient {
            token_cache: Mutex::new(None),
            client_id: env::var("SPOTIFY_CLIENT_ID").expect("SPOTIFY_CLIENT_ID is not set."),
            client_secret: env::var("SPOTIFY_CLIENT_SECRET")
                .expect("SPOTIFY_CLIENT_ID is not set."),
            redirect_uri: env::var("SPOTIFY_REDIRECT_URI").expect("SPOTIFY_CLIENT_ID is not set."),
        };
        info!("Spotify: Create new client with id ${}", client.client_id);
        client
    }

    pub fn client_id(&self) -> &str {
        self.client_id.as_ref()
    }
    pub fn client_secret(&self) -> &str {
        self.client_secret.as_ref()
    }
    pub fn redirect_uri(&self) -> &str {
        self.redirect_uri.as_ref()
    }

    pub async fn exchange_code_for_token(&self, code: &str) -> Result<bool, TokenError> {
        info!("Spotify: exchange code for token");
        let params = [
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", self.redirect_uri()),
            ("client_id", self.client_id()),
            ("client_secret", self.client_secret()),
        ];
        let resp = Client::new()
            .post("https://accounts.spotify.com/api/token")
            .form(&params)
            .send()
            .await
            .map_err(|e| TokenError::FailedToGet(e.to_string()))?;
        let status = resp.status();
        let text = resp
            .text()
            .await
            .map_err(|e| TokenError::FailedToGet(e.to_string()))?;

        if !status.is_success() {
            return if let Ok(err) = serde_json::from_str::<TokenErrorResponse>(&text) {
                return Err(TokenError::FailedToGet(format!(
                    "{}: {}",
                    err.error, err.error_description
                )));
            } else {
                Err(TokenError::FailedToGet(text))
            };
        }

        let resp: TokenResponse = serde_json::from_str(&text).map_err(|e| {
            TokenError::FailedToGet(format!(
                "Failed to parse {} into TokenResponse: {}",
                text,
                e.to_string()
            ))
        })?;
        let mut guard = self.token_cache.lock().await;
        info!("got access token: {}", resp.access_token);
        info!("got refresh token: {}", resp.refresh_token);
        info!("token type {}", resp.token_type);
        let expires_at = Instant::now() + Duration::from_secs(resp.expires_in);
        info!(
            "expires in {}s (at {:?}) (minus margin)",
            resp.expires_in, expires_at
        );
        *guard = Some(StoredToken {
            token_type: resp.token_type,
            access_token: resp.access_token,
            refresh_token: resp.refresh_token,
            expires_at: expires_at - Duration::from_secs(60),
            scope: resp.scope,
        });

        Ok(true)
    }

    async fn refresh_access_token(&self) -> Result<String, TokenError> {
        info!("refresh access token");
        let refresh_token = self.get_refresh_token().await?;
        let params = [
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token.as_str()),
            ("client_id", self.client_id()),
            ("client_secret", self.client_secret()),
        ];

        info!("refresh access token2");
        let resp = Client::new()
            .post("https://accounts.spotify.com/api/token")
            .form(&params)
            .send()
            .await
            .map_err(|e| TokenError::FailedToGet(e.to_string()))?
            .json::<TokenResponse>()
            .await
            .map_err(|e| TokenError::FailedToGet(e.to_string()))?;

        info!("Spotify: refreshed access token: {}", resp.access_token);
        Ok(resp.access_token)
    }

    pub async fn access_token(&self) -> Result<String, TokenError> {
        {
            let guard = self.token_cache.lock().await;
            if let Some(token) = &*guard {
                if token.expires_at > Instant::now() {
                    info!("returning cached access_token: {}", token.access_token);
                    return Ok(token.access_token.clone());
                } else {
                    info!("Access token is expired.");
                }
            } else {
                info!("Access token not available.");
            }
        }
        let mut guard = self.token_cache.lock().await;
        if let Some(guard) = guard.as_mut() {
            info!("Refreshing access token ...");
            guard.access_token = self.refresh_access_token().await.map_err(|err| {
                info!("Refreshing access token failed, {:?}", err);
                err
            })?;
        } else {
            info!("Token cache not available.");
            return Err(TokenError::Missing);
        }
        info!("Spotify: returning refreshed access_token ...");
        guard
            .as_ref()
            .filter(|token| token.expires_at > Instant::now())
            .map(|token| token.access_token.clone())
            .ok_or(TokenError::Missing)
    }

    async fn get_refresh_token(&self) -> Result<String, TokenError> {
        let guard = self.token_cache.lock().await;
        match &*guard {
            Some(token) => Ok(token.refresh_token.clone()),
            _ => Err(TokenError::Missing),
        }
    }

    pub async fn search_tracks(&self, query: &str) -> FieldResult<Value> {
        info!("Spotify: search tracks '{}'", query);
        let token = self.access_token().await?;
        let client = Client::new();
        let res = client
            .get("https://api.spotify.com/v1/search")
            .query(&[("q", query), ("type", "track")])
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| {
                FieldError::new(e.to_string(), graphql_value!({"message": e.to_string()}))
            })?;

        if !res.status().is_success() {
            return Err(FieldError::new(
                format!(
                    "Spotify returned {}: {}",
                    res.status(),
                    res.text().await.unwrap_or_default(),
                ),
                graphql_value!({}),
            ));
        }

        Ok(res.json().await?)
    }

    pub async fn access_token_expires_in(&self) -> Duration {
        let guard = self.token_cache.lock().await;
        if let Some(guard) = &*guard {
            guard.expires_at - Instant::now()
        } else {
            Duration::from_secs(0)
        }
    }
}
