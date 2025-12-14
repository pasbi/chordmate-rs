use deadpool::managed::PoolError;
use deadpool_postgres::{ManagerConfig, Object, Pool, RecyclingMethod, Runtime};
use tokio::task::JoinHandle;
use tokio_postgres::{Error, NoTls, Row};

pub fn config() -> tokio_postgres::Config {
    let mut pg_cfg = tokio_postgres::Config::new();
    pg_cfg.dbname("postgres");
    pg_cfg.host("localhost");
    pg_cfg.user("postgres");
    pg_cfg.password("secret");
    pg_cfg.port(15432);
    pg_cfg.dbname("postgres");
    pg_cfg
}

pub fn new_pool() -> Pool {
    let manager = deadpool_postgres::Manager::from_config(
        config(),
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
