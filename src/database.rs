use deadpool_postgres::{ManagerConfig, Pool, RecyclingMethod, Runtime};
use tokio::task::JoinHandle;
use tokio_postgres::{Error, NoTls, Row};

pub struct Database {
    connection_pool: Pool,
}

impl Database {
    pub fn new() -> Self {
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
        let connection_pool = Pool::builder(manager)
            .max_size(5)
            .runtime(Runtime::Tokio1)
            .build()
            .unwrap();
        Database { connection_pool }
    }

    pub fn query(self: &Self, q: &str) -> JoinHandle<Result<Row, Error>> {
        // clone only creates a new handle to the same pool. It's using Arc internally.
        let pool = self.connection_pool.clone();
        let q = String::from(q);
        tokio::spawn(async move { pool.get().await.unwrap().query_one(&q, &[]).await })
    }
}
