mod database;

use axum::routing::MethodFilter;
use axum::{response::Html, routing::get, Extension, Router};
use deadpool_postgres::{ManagerConfig, Pool, RecyclingMethod, Runtime};
use futures::stream::{BoxStream, FuturesUnordered, StreamExt as _};
use juniper::{graphql_object, graphql_subscription, EmptyMutation, FieldError, RootNode};
use juniper_axum::{graphiql, graphql, playground, ws};
use juniper_graphql_ws::ConnectionConfig;
use sqlx::Error::Database;
use std::future::Future;
use std::{net::SocketAddr, sync::Arc, time::Duration};
use tokio::{net::TcpListener, time::interval};
use tokio_postgres::tls::NoTlsStream;
use tokio_postgres::{Client, Connection, Error, NoTls, Row, Socket};
use tokio_stream::wrappers::IntervalStream;

#[graphql_object]
impl database::Database {
    /// Adds two `a` and `b` numbers.
    fn add(a: i32, b: i32) -> i32 {
        a + b * 2
    }
    async fn testdb(&self, q: String) -> String {
        println!("Start query: {}", q);
        let future = self.query(&q);
        match future.await {
            Ok(inner) => match inner {
                Ok(result) => {
                    println!("Query {} finished: {}", q, result);
                    result
                }
                Err(e) => {
                    println!("Query {} failed: {}", q, e);
                    String::from(format!("Query returned error: {}", e))
                }
            },
            Err(e) => {
                println!("Tasks panicked: {:?}", e);
                String::from(format!("Internal error: {:?}", e))
            }
        }
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

#[tokio::main]
async fn main() {
    let schema = Schema::new(
        database::Database::new(),
        EmptyMutation::new(),
        Subscription,
    );
    let app = Router::new()
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
        .layer(Extension(Arc::new(schema)));
    let listener = TcpListener::bind("127.0.0.1:3000")
        .await
        .expect("Failed to start TCP listener.");

    println!("listening on http://{}", listener.local_addr().unwrap());

    axum::serve(listener, app).await.unwrap();
}
