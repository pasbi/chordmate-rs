use clap::Parser;
use log::{info, LevelFilter};

#[derive(Parser, Debug)]
#[command(rename_all = "kebab-case")]
pub struct DatabaseArgs {
    #[arg(long, env = "DB_HOST", help = "The hostname of the database server.")]
    pub db_host: String,
    #[arg(long, env = "DB_PORT", help = "The port of the database server.")]
    pub db_port: u16,
    #[arg(long, env = "DB_USER", help = "The username of the database server.")]
    pub db_user: String,
    #[arg(long, env = "DB_NAME", help = "The name of the database server.")]
    pub db_name: String,
    #[arg(
        long,
        env = "DB_PASSWORD",
        help = "The password of the database server."
    )]
    pub db_password: String,
}

impl DatabaseArgs {
    pub fn config(self) -> tokio_postgres::Config {
        info!(
            "Database '{}' config: {}@{}:{}",
            self.db_name, self.db_user, self.db_host, self.db_port
        );
        tokio_postgres::Config::new()
            .host(self.db_host)
            .port(self.db_port)
            .dbname(self.db_name)
            .user(self.db_user)
            .password(self.db_password)
            .clone()
    }
}

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
pub struct MigrationArgs {
    #[command(flatten)]
    pub db: DatabaseArgs,
}

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
pub struct ChordmateArgs {
    #[command(flatten)]
    pub db: DatabaseArgs,
    #[arg(
        long,
        env = "CHORDMATE_PORT",
        help = "The port where this service will become available."
    )]
    pub port: u16,

    #[arg(long, value_enum, default_value = "info")]
    pub log_level: LevelFilter,
}
