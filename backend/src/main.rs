mod database;
use axum::routing::MethodFilter;
use axum::{response::Html, routing::get, Extension, Router};
use chordmate::database::Song;
use futures::stream::{BoxStream, StreamExt as _};
use juniper::{
    graphql_object, graphql_subscription, EmptyMutation, FieldError, FieldResult, RootNode,
};
use juniper_axum::{graphiql, graphql, playground, ws};
use juniper_graphql_ws::ConnectionConfig;
use std::{sync::Arc, time::Duration};
use tokio::{net::TcpListener, time::interval};
use tokio_stream::wrappers::IntervalStream;
use tower_http::cors::{AllowOrigin, Any, CorsLayer};
use tower_http::services::fs::ServeDir;

#[graphql_object]
impl database::Database {
    /// Adds two `a` and `b` numbers.
    fn add(a: i32, b: i32) -> i32 {
        a + b * 2
    }

    /// Tests the database.
    async fn testdb(&self, key: String, q: String) -> String {
        println!("Start query: {}", q);
        self.query(&q)
            .await
            .unwrap_or_else(|e| panic!("Internal error: {}", e))
            .and_then(|row| row.try_get(key.as_str()))
            .unwrap_or_else(|e| format!("Error: {}", e))
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

#[derive(Clone, Copy, Debug)]
struct Subscription;
type NumberStream = BoxStream<'static, Result<i32, FieldError>>;

#[graphql_subscription]
impl Subscription {
    /// Counts seconds.
    async fn count() -> NumberStream {
        let mut value = 0;
        let stream = IntervalStream::new(interval(Duration::from_secs(1))).map(move |_| {
            value += 1;
            Ok(value)
        });
        Box::pin(stream)
    }
}
type Schema = RootNode<database::Database, EmptyMutation, Subscription>;
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

fn router(database: database::Database) -> Router {
    // During development, we want to use the frontend served by `npm start`.
    // That's faster development cycles than `npm run build; cargo run`.
    // However, we need to allow CORS to make it work.
    // Make sure that `npm start` serves on the origin that is mentioned below.
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::exact("http://localhost:3001".parse().unwrap()))
        .allow_methods(Any)
        .allow_headers(Any);

    let schema = Schema::new(database, EmptyMutation::new(), Subscription);
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
}

#[tokio::main]
async fn main() {
    let listener = TcpListener::bind("127.0.0.1:3000")
        .await
        .expect("Failed to start TCP listener.");

    println!("listening on http://{}", listener.local_addr().unwrap());
    let database = database::Database::new();

    axum::serve(listener, router(database)).await.unwrap();
}
