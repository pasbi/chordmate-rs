use deadpool_postgres::{ManagerConfig, Pool, RecyclingMethod, Runtime};
use tokio::task::JoinHandle;
use tokio_postgres::NoTls;

pub struct Database {
    pool: Pool,
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
        let pool = Pool::builder(manager)
            .max_size(5)
            .runtime(Runtime::Tokio1)
            .build()
            .unwrap();
        Database { pool }
    }

    pub fn query(self: &Self, q: &str) -> JoinHandle<()> {
        let pool = self.pool.clone();
        let q = String::from(q);
        tokio::spawn(async move {
            let client = pool.get().await.unwrap();
            let row = client.query_one(&q, &[]).await.unwrap();
            let name: &str = row.get("name");
            println!("Result: {}", name)
        })
    }
}
