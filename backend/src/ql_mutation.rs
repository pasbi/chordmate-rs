use crate::database_connection::DatabaseConnection;
use juniper::graphql_object;

pub struct QLMutation {
    pub database_connection: DatabaseConnection,
}

#[graphql_object]
impl QLMutation {
    fn add_song(title: String) -> bool {
        true
    }
}
