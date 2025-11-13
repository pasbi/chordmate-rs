use juniper::GraphQLObject;

#[derive(GraphQLObject, Clone)]
pub struct Song {
    pub id: i32,
    pub title: String,
    pub artist: String,
    pub spotify_track_id: String,
    pub content: String,
}
