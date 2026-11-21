import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { useMemo } from "react";
import { type SectionKey, sectionKeyString } from "../lib/autoScroll.ts";

/** When a section of the sheet starts in the song's track. */
export interface SectionAnchor extends SectionKey {
  id: number;
  positionMs: number;
}

const ANCHOR_FIELDS = gql`
  fragment SectionAnchorFields on SectionAnchor {
    id
    heading
    occurrence
    positionMs
  }
`;

const GET_SECTION_ANCHORS = gql`
  ${ANCHOR_FIELDS}
  query GetSectionAnchors($songId: Int!, $spotifyTrack: String!) {
    sectionAnchors(songId: $songId, spotifyTrack: $spotifyTrack) {
      ...SectionAnchorFields
    }
  }
`;

const SET_SECTION_ANCHOR = gql`
  ${ANCHOR_FIELDS}
  mutation SetSectionAnchor(
    $songId: Int!
    $spotifyTrack: String!
    $heading: String!
    $occurrence: Int!
    $positionMs: Int!
  ) {
    setSectionAnchor(
      songId: $songId
      spotifyTrack: $spotifyTrack
      heading: $heading
      occurrence: $occurrence
      positionMs: $positionMs
    ) {
      ...SectionAnchorFields
    }
  }
`;

const DELETE_SECTION_ANCHOR = gql`
  mutation DeleteSectionAnchor($id: Int!) {
    deleteSectionAnchor(id: $id)
  }
`;

const DELETE_SECTION_ANCHORS = gql`
  mutation DeleteSectionAnchors($songId: Int!, $spotifyTrack: String!) {
    deleteSectionAnchors(songId: $songId, spotifyTrack: $spotifyTrack)
  }
`;

interface GetSectionAnchorsData {
  sectionAnchors: SectionAnchor[];
}
interface GetSectionAnchorsVars {
  songId: number;
  spotifyTrack: string;
}
interface SetSectionAnchorVars extends SectionKey {
  songId: number;
  spotifyTrack: string;
  positionMs: number;
}

export type SectionAnchors = ReturnType<typeof useSectionAnchors>;

/**
 * The anchored sections of a song's sheet in its current Spotify track, by section key. Like
 * bookmarks, anchors of other tracks stay stored and come back with their track.
 */
export function useSectionAnchors(songId: number, spotifyTrack: string) {
  const variables = { songId, spotifyTrack };
  const { data } = useQuery<GetSectionAnchorsData, GetSectionAnchorsVars>(GET_SECTION_ANCHORS, {
    variables,
    skip: spotifyTrack === "",
  });
  const refetchQueries = [{ query: GET_SECTION_ANCHORS, variables }];
  const [setMutation] = useMutation<unknown, SetSectionAnchorVars>(SET_SECTION_ANCHOR);
  const [deleteMutation] = useMutation<unknown, { id: number }>(DELETE_SECTION_ANCHOR);
  const [deleteAllMutation] = useMutation<unknown, GetSectionAnchorsVars>(DELETE_SECTION_ANCHORS);

  const byKey = useMemo(
    () => new Map((data?.sectionAnchors ?? []).map((anchor) => [sectionKeyString(anchor), anchor])),
    [data]
  );

  /** Anchors a section at a position, replacing its earlier anchor. */
  const set = (section: SectionKey, positionMs: number) =>
    setMutation({
      variables: { songId, spotifyTrack, ...section, positionMs: Math.round(positionMs) },
      refetchQueries,
      awaitRefetchQueries: true,
    });

  const remove = (anchor: SectionAnchor) =>
    deleteMutation({ variables: { id: anchor.id }, refetchQueries, awaitRefetchQueries: true });

  /** Removes all anchors of the track, also those of headings no longer in the sheet. */
  const removeAll = () =>
    deleteAllMutation({ variables, refetchQueries, awaitRefetchQueries: true });

  return { byKey, set, remove, removeAll };
}
