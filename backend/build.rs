// The migrate binary embeds the SQL files at compile time (refinery's `embed_migrations!`), but
// Cargo doesn't see them as inputs: without this, a new migration needs a manual rebuild.
fn main() {
    println!("cargo:rerun-if-changed=migrations");
}
