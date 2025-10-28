use axum::routing::MethodFilter;
use axum::{response::Html, routing::get, Extension, Router};
use futures::stream::{BoxStream, StreamExt as _};
use juniper::{graphql_object, graphql_subscription, EmptyMutation, FieldError, RootNode};
use juniper_axum::{graphiql, graphql, playground, ws};
use juniper_graphql_ws::ConnectionConfig;
use std::{net::SocketAddr, sync::Arc, time::Duration};
use tokio::{net::TcpListener, time::interval};
use tokio_stream::wrappers::IntervalStream;

#[derive(Clone, Copy, Debug)]
struct Query;

#[graphql_object]
impl Query {
    /// Adds two `a` and `b` numbers.
    fn add(a: i32, b: i32) -> i32 {
        a + b * 2
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
type Schema = RootNode<Query, EmptyMutation, Subscription>;
async fn homepage() -> Html<&'static str> {
    "<html><h1>juniper_axum/simple example</h1>\
           <div>visit <a href=\"/graphiql\">GraphiQL</a></div>\
           <div>visit <a href=\"/playground\">GraphQL Playground</a></div>\
    </html>"
        .into()
}

#[tokio::main]
async fn main() {
    let schema = Schema::new(Query, EmptyMutation::new(), Subscription);
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
