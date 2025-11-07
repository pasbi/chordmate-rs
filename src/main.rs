use axum::routing::MethodFilter;
use axum::{response::Html, routing::get, Extension, Router};
use deadpool_postgres::{ManagerConfig, Pool, RecyclingMethod, Runtime};
use futures::stream::{BoxStream, FuturesUnordered, StreamExt as _};
use juniper::{graphql_object, graphql_subscription, EmptyMutation, FieldError, RootNode};
use juniper_axum::{graphiql, graphql, playground, ws};
use juniper_graphql_ws::ConnectionConfig;
use std::future::Future;
use std::{net::SocketAddr, sync::Arc, time::Duration};
use tokio::{net::TcpListener, time::interval};
use tokio_postgres::tls::NoTlsStream;
use tokio_postgres::{Client, Connection, Error, NoTls, Row, Socket};
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

// #[tokio::main]
// async fn main() {
//     let schema = Schema::new(Query, EmptyMutation::new(), Subscription);
//     let app = Router::new()
//         .route(
//             "/graphql",
//             axum::routing::on(
//                 MethodFilter::GET.or(MethodFilter::POST),
//                 graphql::<Arc<Schema>>,
//             ),
//         )
//         .route(
//             "/subscriptions",
//             get(ws::<Arc<Schema>>(ConnectionConfig::new(()))),
//         )
//         .route("/graphiql", get(graphiql("/graphql", "/subscriptions")))
//         .route("/playground", get(playground("/graphql", "/subscriptions")))
//         .route("/", get(homepage))
//         .layer(Extension(Arc::new(schema)));
//     let listener = TcpListener::bind("127.0.0.1:3000")
//         .await
//         .expect("Failed to start TCP listener.");
//
//     println!("listening on http://{}", listener.local_addr().unwrap());
//
//     axum::serve(listener, app).await.unwrap();
// }

#[tokio::main]
async fn main() {
    let mut pg_cfg = tokio_postgres::Config::new();
    pg_cfg.dbname("postgres");
    pg_cfg.host("localhost");
    pg_cfg.user("postgres");
    pg_cfg.password("secret");
    pg_cfg.port(15432);
    pg_cfg.dbname("postgres");
    let manager = deadpool_postgres::Manager::from_config(
        pg_cfg,
        NoTls,
        ManagerConfig {
            recycling_method: RecyclingMethod::Fast,
        },
    );
    let pool = Pool::builder(manager)
        .max_size(5)
        .runtime(Runtime::Tokio1)
        .build()
        .unwrap();

    println!("Pool created");
    dbg!(pool.status());

    let queries = vec![
        "SELECT pg_sleep(10), '10' AS Name",
        "SELECT pg_sleep(1), '1' AS Name",
        "SELECT pg_sleep(0.3), '0.3' AS Name",
        "SELECT pg_sleep(5), '5' AS Name",
    ];

    let mut futures: FuturesUnordered<_> = queries
        .into_iter()
        .map(|q| {
            // pool.clone only creates a new handle to the same pool. It's using Arc internally.
            let pool = pool.clone();
            tokio::spawn(async move {
                let client = pool.get().await.unwrap();
                let row = client.query_one(q, &[]).await?;
                let name: &str = row.get("name");
                Ok::<_, Error>(name.to_string())
            })
        })
        .collect();

    // React as queries complete
    while let Some(result) = futures.next().await {
        match result {
            Ok(Ok(name)) => println!("Query completed: {}", name),
            Ok(Err(e)) => eprintln!("Query error: {}", e),
            Err(e) => eprintln!("Task panicked: {:?}", e),
        }
    }
}
