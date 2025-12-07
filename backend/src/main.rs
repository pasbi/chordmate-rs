use axum::body::{Body, Bytes};
use axum::http::Request;
use axum::middleware::from_fn;
use axum::routing::MethodFilter;
use axum::{body, response::Html, routing::get, Extension, Router};
use chordmate::database_connection::DatabaseConnection;
use chordmate::ql_mutation::QLMutation;
use chordmate::ql_query::QLQuery;
use chordmate::spotify::{SpotifyClient, SpotifyError};
use juniper::{EmptySubscription, RootNode};
use juniper_axum::{graphiql, graphql, playground, ws};
use juniper_graphql_ws::ConnectionConfig;
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
async fn spa_index() -> Html<&'static str> {
    Html(include_str!("../../frontend/build/index.html"))
}

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

fn router(query: QLQuery, mutation: QLMutation) -> Router {
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
        .route("/", get(homepage))
        .fallback(spa_index)
        .layer(cors)
        .layer(Extension(Arc::new(schema)))
        .layer(from_fn(log_requests))
}

async fn serve(database_connection_pool: Pool) {
    let listener = TcpListener::bind("0.0.0.0:3000")
        .await
        .expect("Failed to start TCP listener.");

    println!("listening on http://{}", listener.local_addr().unwrap());
    axum::serve(
        listener,
        router(
            QLQuery {
                database_connection: DatabaseConnection {
                    connection_pool: database_connection_pool.clone(),
                },
            },
            QLMutation {
                database_connection: DatabaseConnection {
                    connection_pool: database_connection_pool.clone(),
                },
            },
        ),
    )
    .await
    .unwrap();
}

#[tokio::main]
async fn main() {
    let database_connection_pool = chordmate::database_connection::new_pool();
    let server_handle = tokio::spawn(async move {
        serve(database_connection_pool).await;
    });
    let spotify_client = SpotifyClient::new();
    match spotify_client.get_spotify_token().await {
        Ok(token) => {
            println!("Spotify token: {}", token)
        }
        Err(err) => {
            println!("Spotify error: {}", err)
        }
    }

    server_handle.await.unwrap();
}
