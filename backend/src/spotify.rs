use crate::database_connection::DatabaseConnection;
use juniper::{graphql_value, FieldError, FieldResult};
use log::info;
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;
use std::env;
use std::time::{Duration, SystemTime};
use tokio::sync::Mutex;

/// Access tokens are treated as expired this long before Spotify says they expire.
const EXPIRY_MARGIN: Duration = Duration::from_secs(60);

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    /// Spotify does not always return a new refresh token when refreshing.
    /// In that case, the previous one stays valid.
    refresh_token: Option<String>,
    expires_in: u64,
}

struct StoredToken {
    access_token: String,
    refresh_token: String,
    // Wall-clock time: `Instant` doesn't advance while the machine sleeps (on Linux), so a token
    // that expired during sleep would still look valid afterwards.
    expires_at: SystemTime,
}

impl StoredToken {
    fn is_expired(&self) -> bool {
        self.expires_at <= SystemTime::now()
    }
}

pub struct SpotifyClient {
    token_cache: Mutex<Option<StoredToken>>,
    /// Shared, so that requests reuse connections.
    http: Client,
    database_connection: DatabaseConnection,
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

fn required_env_var(name: &str) -> String {
    env::var(name).unwrap_or_else(|_| panic!("{name} is not set."))
}

impl SpotifyClient {
    pub fn new(database_connection: DatabaseConnection) -> Self {
        let client = SpotifyClient {
            token_cache: Mutex::new(None),
            http: Client::new(),
            database_connection,
            client_id: required_env_var("SPOTIFY_CLIENT_ID"),
            client_secret: required_env_var("SPOTIFY_CLIENT_SECRET"),
            redirect_uri: required_env_var("SPOTIFY_REDIRECT_URI"),
        };
        info!("Spotify: Create new client with id {}", client.client_id);
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

    /// Posts `params` to Spotify's token endpoint.
    async fn request_token(&self, params: &[(&str, &str)]) -> Result<TokenResponse, TokenError> {
        let resp = self
            .http
            .post("https://accounts.spotify.com/api/token")
            .form(params)
            .send()
            .await
            .map_err(|e| TokenError::FailedToGet(e.to_string()))?;
        let status = resp.status();
        let text = resp
            .text()
            .await
            .map_err(|e| TokenError::FailedToGet(e.to_string()))?;

        if !status.is_success() {
            return Err(TokenError::FailedToGet(
                match serde_json::from_str::<TokenErrorResponse>(&text) {
                    Ok(err) => format!("{}: {}", err.error, err.error_description),
                    Err(_) => text,
                },
            ));
        }

        serde_json::from_str(&text)
            .map_err(|e| TokenError::FailedToGet(format!("Failed to parse token response: {e}")))
    }

    pub async fn exchange_code_for_token(&self, code: &str) -> Result<(), TokenError> {
        info!("Spotify: exchange code for token");
        let resp = self
            .request_token(&[
                ("grant_type", "authorization_code"),
                ("code", code),
                ("redirect_uri", self.redirect_uri()),
                ("client_id", self.client_id()),
                ("client_secret", self.client_secret()),
            ])
            .await?;
        let refresh_token = resp.refresh_token.ok_or_else(|| {
            TokenError::FailedToGet(String::from("Authorization returned no refresh token."))
        })?;
        self.save_refresh_token(&refresh_token).await?;
        *self.token_cache.lock().await = Some(StoredToken {
            access_token: resp.access_token,
            refresh_token,
            expires_at: SystemTime::now() + Duration::from_secs(resp.expires_in) - EXPIRY_MARGIN,
        });
        Ok(())
    }

    /// Replaces the expired access token in `token` with a fresh one.
    async fn refresh(&self, token: &mut StoredToken) -> Result<(), TokenError> {
        info!("Spotify: refresh access token");
        let resp = self
            .request_token(&[
                ("grant_type", "refresh_token"),
                ("refresh_token", token.refresh_token.as_str()),
                ("client_id", self.client_id()),
                ("client_secret", self.client_secret()),
            ])
            .await?;
        if let Some(refresh_token) = resp.refresh_token {
            self.save_refresh_token(&refresh_token).await?;
            token.refresh_token = refresh_token;
        }
        token.access_token = resp.access_token;
        token.expires_at = SystemTime::now() + Duration::from_secs(resp.expires_in) - EXPIRY_MARGIN;
        Ok(())
    }

    /// Returns a valid access token, refreshing it if necessary.
    /// After a restart, the refresh token is loaded from the database.
    /// The lock is held while refreshing so that concurrent requests trigger only one refresh.
    pub async fn access_token(&self) -> Result<String, TokenError> {
        let mut cache = self.token_cache.lock().await;
        if cache.is_none() {
            *cache = self.load_token().await?;
        }
        let token = cache.as_mut().ok_or(TokenError::Missing)?;
        if token.is_expired() {
            self.refresh(token).await.inspect_err(|err| {
                info!("Spotify: refreshing access token failed: {err:?}");
            })?;
        }
        Ok(token.access_token.clone())
    }

    pub async fn access_token_expires_in(&self) -> Duration {
        match &*self.token_cache.lock().await {
            Some(token) => token
                .expires_at
                .duration_since(SystemTime::now())
                .unwrap_or(Duration::ZERO),
            None => Duration::ZERO,
        }
    }

    /// Loads the stored refresh token. The returned access token is expired and must be refreshed.
    async fn load_token(&self) -> Result<Option<StoredToken>, TokenError> {
        let client = self
            .database_connection
            .get()
            .await
            .map_err(|e| TokenError::FailedToGet(e.to_string()))?;
        let row = client
            .query_opt("SELECT refresh_token FROM spotify_token WHERE id = 1", &[])
            .await
            .map_err(|e| TokenError::FailedToGet(e.to_string()))?;
        Ok(row.map(|row| StoredToken {
            access_token: String::new(),
            refresh_token: row.get("refresh_token"),
            expires_at: SystemTime::now(),
        }))
    }

    async fn save_refresh_token(&self, refresh_token: &str) -> Result<(), TokenError> {
        let client = self
            .database_connection
            .get()
            .await
            .map_err(|e| TokenError::FailedToGet(e.to_string()))?;
        client
            .execute(
                "INSERT INTO spotify_token (id, refresh_token) VALUES (1, $1) \
                 ON CONFLICT (id) DO UPDATE SET refresh_token = EXCLUDED.refresh_token",
                &[&refresh_token],
            )
            .await
            .map_err(|e| TokenError::FailedToGet(e.to_string()))?;
        Ok(())
    }

    pub async fn search_tracks(&self, query: &str) -> FieldResult<Value> {
        info!("Spotify: search tracks '{}'", query);
        let token = self.access_token().await?;
        let res = self
            .http
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
}
