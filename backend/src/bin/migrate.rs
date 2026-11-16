use chordmate::arguments::MigrationArgs;
use clap::Parser;
use refinery::embed_migrations;
use tokio_postgres::NoTls;

embed_migrations!("./migrations");

#[tokio::main]
async fn main() {
    let args = MigrationArgs::parse();
    let (mut client, connection) = args.db.config().connect(NoTls).await.unwrap();

    // Drive the connection on a background task
    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("connection error: {}", e);
        }
    });
    let report = migrations::runner().run_async(&mut client).await.unwrap();
    let applied = report.applied_migrations();
    if applied.is_empty() {
        println!("The database is up to date.");
    }
    for migration in applied {
        println!(
            "Applied migration {}: {}",
            migration.version(),
            migration.name()
        );
    }
}
