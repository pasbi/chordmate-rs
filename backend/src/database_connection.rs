use crate::arguments::DatabaseArgs;
use deadpool::managed::PoolError;
use deadpool_postgres::{ManagerConfig, Object, Pool, RecyclingMethod, Runtime};
use tokio::task::JoinHandle;
use tokio_postgres::{Error, NoTls, Row};

pub fn new_pool(args: DatabaseArgs) -> Pool {
    let config = args.config();
    let manager = deadpool_postgres::Manager::from_config(
        config,
        NoTls,
        ManagerConfig {
            recycling_method: RecyclingMethod::Fast,
        },
    );
    Pool::builder(manager)
        .max_size(5)
        .runtime(Runtime::Tokio1)
        .build()
        .unwrap()
}

pub struct DatabaseConnection {
    pub connection_pool: Pool,
}

impl DatabaseConnection {
    pub fn query(self: &Self, q: &str) -> JoinHandle<Result<Row, Error>> {
        // clone only creates a new handle to the same pool. It's using Arc internally.
        let pool = self.connection_pool.clone();
        let q = String::from(q);
        tokio::spawn(async move { pool.get().await.unwrap().query_one(&q, &[]).await })
    }

    pub async fn get(&self) -> Result<Object, PoolError<Error>> {
        let pool = self.connection_pool.clone();
        pool.get()
            .await
            .inspect_err(|error| eprintln!("Error: {error}"))
    }
}
