use chordmate::database;

use refinery::embed_migrations;
use tokio_postgres::NoTls;
embed_migrations!("./migrations");

#[tokio::main]
async fn main() {
    let config = database::config();
    let (mut client, connection) = config.connect(NoTls).await.unwrap();

    // Drive the connection on a background task
    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("connection error: {}", e);
        }
    });
    println!("Running migrations...");
    for m in migrations::runner().get_migrations() {
        println!("{}: {}", m.version(), m.name());
        println!("SQL: {}", m.sql().unwrap_or(""));
    }
    migrations::runner().run_async(&mut client).await.unwrap();
    println!("All migrations applied successfully!");
}
