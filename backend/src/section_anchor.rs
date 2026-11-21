use juniper::GraphQLObject;
use tokio_postgres::{Error, Row};

/// When a section of a song's sheet starts in its Spotify track: the section's heading text,
/// which occurrence of that text it is (from 1), and the position.
#[derive(GraphQLObject, Clone, Debug)]
pub struct SectionAnchor {
    pub id: i32,
    pub heading: String,
    pub occurrence: i32,
    pub position_ms: i32,
}

impl SectionAnchor {
    pub fn from_row(row: &Row) -> Result<SectionAnchor, Error> {
        Ok(SectionAnchor {
            id: row.try_get("id")?,
            heading: row.try_get("heading")?,
            occurrence: row.try_get("occurrence")?,
            position_ms: row.try_get("position_ms")?,
        })
    }
}
