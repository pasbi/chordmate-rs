use axum::body::{Body, Bytes};
use axum::extract::Query;
use axum::http::{Request, StatusCode};
use axum::response::Redirect;
use axum::routing::MethodFilter;
use axum::{body, response::Html, routing::get, Extension, Json, Router};
use chordmate::database_connection::DatabaseConnection;
use chordmate::ql_mutation::QLMutation;
use chordmate::ql_query::QLQuery;
use chordmate::spotify::{SpotifyClient, TokenError};
use deadpool_postgres::Pool;
use dotenvy::dotenv;
use juniper::{EmptySubscription, RootNode};
use juniper_axum::{graphiql, graphql, playground, ws};
use juniper_graphql_ws::ConnectionConfig;
use log::info;
use simple_logger::SimpleLogger;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::fs::ServeDir;

type Schema = RootNode<QLQuery, QLMutation, EmptySubscription>;
async fn homepage() -> Html<&'static str> {
    "<html><h1>juniper_axum/simple example</h1>\
           <div>visit <a href=\"/graphiql\">GraphiQL</a></div>\
           <div>visit <a href=\"/playground\">GraphQL Playground</a></div>\
    </html>"
        .into()
}
#[allow(unused)]
async fn log_requests(
    mut req: Request<Body>,
    next: axum::middleware::Next,
) -> axum::response::Response {
    let body = std::mem::replace(req.body_mut(), Body::empty());
    let bytes = body::to_bytes(body, usize::MAX)
        .await
        .unwrap_or_else(|_| Bytes::new());
    let body_str = String::from_utf8_lossy(&bytes);
    println!("Raw request body: {}", body_str);
    *req.body_mut() = Body::from(bytes);
    next.run(req).await
}

async fn spotify_callback(
    query: Query<HashMap<String, String>>,
    Extension(spotify_client): Extension<Arc<SpotifyClient>>,
) -> Result<Redirect, (StatusCode, &'static str)> {
    let code = query
        .get("code")
        .ok_or((StatusCode::BAD_REQUEST, "Missing code"))?;

    spotify_client
        .exchange_code_for_token(code)
        .await
        .map_err(|e| {
            let message = match e {
                TokenError::Missing => String::from("missing"),
                TokenError::FailedToGet(s) => {
                    format!("failed to get: {s}")
                }
            };
            println!("message: {message}");
            (StatusCode::BAD_REQUEST, "Failed to get token.")
        })?;

    let state = query.get("state").map(|s| s.as_str()).unwrap_or("/");

    Ok(Redirect::to(state))
}
fn router(query: QLQuery, mutation: QLMutation, spotify_client: Arc<SpotifyClient>) -> Router {
    // During development, we want to use the frontend served by `npm start`.
    // That's faster development cycles than `npm run build; cargo run`.
    // However, we need to allow CORS to make it work.
    // Make sure that `npm start` serves on the origin that is mentioned below.
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let schema = Schema::new(query, mutation, EmptySubscription::new());
    Router::new()
        .nest_service("/static", ServeDir::new("../frontend/build/static"))
        .route(
            "/graphql",
            axum::routing::on(
                MethodFilter::GET.or(MethodFilter::POST),
                graphql::<Arc<Schema>>,
            ),
        )
        .route(
            "/subscriptions",
            get(ws::<Arc<Schema>>(ConnectionConfig::new(()))),
        )
        .route("/graphiql", get(graphiql("/graphql", "/subscriptions")))
        .route("/playground", get(playground("/graphql", "/subscriptions")))
        .route("/callback", get(spotify_callback))
        .route(
            "/spotify",
            get({
                let spotify_client = spotify_client.clone();
                || async move {
                    Json(serde_json::json!({
                        "clientId": spotify_client.client_id(),
                        "redirectUri": spotify_client.redirect_uri(),
                        "accessToken": spotify_client.access_token().await.ok(),
                        "expiresInSeconds": spotify_client.access_token_expires_in().await.as_secs(),
                    }))
                }
            }),
        )
        .route("/", get(homepage))
        .layer(cors)
        .layer(Extension(Arc::new(schema)))
        .layer(Extension(spotify_client.clone()))
    // .layer(from_fn(log_requests))
}

async fn serve(database_connection_pool: Pool) {
    let listener = TcpListener::bind("0.0.0.0:3000")
        .await
        .expect("Failed to start TCP listener.");

    println!("listening on http://{}", listener.local_addr().unwrap());
    let spotify_client = Arc::new(SpotifyClient::new());

    axum::serve(
        listener,
        router(
            QLQuery {
                database_connection: DatabaseConnection {
                    connection_pool: database_connection_pool.clone(),
                },
                spotify_client: spotify_client.clone(),
            },
            QLMutation {
                database_connection: DatabaseConnection {
                    connection_pool: database_connection_pool.clone(),
                },
            },
            spotify_client,
        ),
    )
    .await
    .unwrap();
}

#[tokio::main]
async fn main() {
    SimpleLogger::new().init().unwrap();
    dotenv().ok();
    let database_connection_pool = chordmate::database_connection::new_pool();
    let server_handle = tokio::spawn(async move {
        serve(database_connection_pool).await;
    });

    info!("waiting for requests ...");
    server_handle.await.unwrap();
}
