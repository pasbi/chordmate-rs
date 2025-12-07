use juniper::GraphQLObject;

#[derive(GraphQLObject)]
pub struct SpotifyTrack {
    pub id: String,
    pub name: String,
    pub artists: Vec<String>,
    pub preview_url: Option<String>,
    pub album_art: Option<String>,
}
