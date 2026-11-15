use crate::arguments::DatabaseArgs;
use deadpool::managed::PoolError;
use deadpool_postgres::{ManagerConfig, Object, Pool, RecyclingMethod, Runtime};
use tokio_postgres::{Error, NoTls};

pub fn new_pool(args: DatabaseArgs) -> Pool {
    let config = args.config();
    let manager = deadpool_postgres::Manager::from_config(
        config,
        NoTls,
        ManagerConfig {
            // Checks a connection before reusing it: after the machine slept, Postgres may have
            // closed it, and the request using it would fail.
            recycling_method: RecyclingMethod::Verified,
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
    pub async fn get(&self) -> Result<Object, PoolError<Error>> {
        let pool = self.connection_pool.clone();
        pool.get()
            .await
            .inspect_err(|error| eprintln!("Error: {error}"))
    }
}
