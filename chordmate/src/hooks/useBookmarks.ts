import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { useCallback, useMemo, useState } from "react";
import type Bookmark from "../types/Bookmark";

const BOOKMARK_FIELDS = gql`
  fragment BookmarkFields on Bookmark {
    id
    positionMs
    label
    endMs
  }
`;

const GET_BOOKMARKS = gql`
  ${BOOKMARK_FIELDS}
  query GetBookmarks($songId: Int!, $spotifyTrack: String!) {
    bookmarks(songId: $songId, spotifyTrack: $spotifyTrack) {
      ...BookmarkFields
    }
  }
`;

const ADD_BOOKMARK = gql`
  ${BOOKMARK_FIELDS}
  mutation AddBookmark(
    $songId: Int!
    $spotifyTrack: String!
    $positionMs: Int!
    $label: String!
    $endMs: Int
  ) {
    addBookmark(
      songId: $songId
      spotifyTrack: $spotifyTrack
      positionMs: $positionMs
      label: $label
      endMs: $endMs
    ) {
      ...BookmarkFields
    }
  }
`;

const UPDATE_BOOKMARK = gql`
  ${BOOKMARK_FIELDS}
  mutation UpdateBookmark($id: Int!, $positionMs: Int!, $label: String!, $endMs: Int) {
    updateBookmark(id: $id, positionMs: $positionMs, label: $label, endMs: $endMs) {
      ...BookmarkFields
    }
  }
`;

const DELETE_BOOKMARK = gql`
  mutation DeleteBookmark($id: Int!) {
    deleteBookmark(id: $id)
  }
`;

interface GetBookmarksData {
  bookmarks: Bookmark[];
}
interface GetBookmarksVars {
  songId: number;
  spotifyTrack: string;
}
interface AddBookmarkData {
  addBookmark: Bookmark;
}
interface AddBookmarkVars {
  songId: number;
  spotifyTrack: string;
  positionMs: number;
  label: string;
  endMs: number | null;
}
interface UpdateBookmarkData {
  // The type name lets the optimistic response update the cached bookmark.
  updateBookmark: Bookmark & { __typename: "Bookmark" };
}
interface UpdateBookmarkVars {
  id: number;
  positionMs: number;
  label: string;
  endMs: number | null;
}
interface DeleteBookmarkData {
  deleteBookmark: boolean;
}
interface DeleteBookmarkVars {
  id: number;
}

/** The name of the fixed entry for where Play was last pressed. */
export const LAST_PLAY_START_LABEL = "Last play start";

/** The bookmark ↺ jumps to; null means where Play was last pressed. */
export type ActiveBookmarkId = number | null;

function activeStorageKey(songId: number, spotifyTrack: string) {
  return `chordmate.activeBookmark.${songId}.${spotifyTrack}`;
}

function readActiveId(storageKey: string): ActiveBookmarkId {
  try {
    const value = Number(localStorage.getItem(storageKey));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeActiveId(storageKey: string, id: ActiveBookmarkId) {
  try {
    if (id === null) {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, String(id));
    }
  } catch {
    // Not remembered, but still applied for this page.
  }
}

/**
 * Which bookmark is active, remembered in this browser per song and track. A remembered bookmark
 * that no longer exists counts as none.
 */
function useActiveBookmarkId(songId: number, spotifyTrack: string, bookmarks: Bookmark[]) {
  const storageKey = activeStorageKey(songId, spotifyTrack);
  // Keyed by the storage key, so that another song or track starts with its own remembered value.
  const [stored, setStored] = useState(() => ({ storageKey, id: readActiveId(storageKey) }));
  const storedId = stored.storageKey === storageKey ? stored.id : readActiveId(storageKey);
  const activeId = bookmarks.some((bookmark) => bookmark.id === storedId) ? storedId : null;
  const setActiveId = useCallback(
    (id: ActiveBookmarkId) => {
      writeActiveId(storageKey, id);
      setStored({ storageKey, id });
    },
    [storageKey]
  );
  return { activeId, setActiveId };
}

function roundOrNull(milliseconds: number | null) {
  return milliseconds === null ? null : Math.round(milliseconds);
}

export type Bookmarks = ReturnType<typeof useBookmarks>;

type RemovedBookmark = { bookmark: Bookmark; wasActive: boolean; spotifyTrack: string };

/**
 * The bookmarks of a song in its current Spotify track, sorted by position, and which one is
 * active. Bookmarks of other tracks stay stored and come back when their track is linked again.
 */
export function useBookmarks(songId: number, spotifyTrack: string) {
  const variables = { songId, spotifyTrack };
  const { data } = useQuery<GetBookmarksData, GetBookmarksVars>(GET_BOOKMARKS, {
    variables,
    skip: spotifyTrack === "",
  });
  const refetchQueries = [{ query: GET_BOOKMARKS, variables }];
  const [addMutation] = useMutation<AddBookmarkData, AddBookmarkVars>(ADD_BOOKMARK);
  const [updateMutation] = useMutation<UpdateBookmarkData, UpdateBookmarkVars>(UPDATE_BOOKMARK);
  const [deleteMutation] = useMutation<DeleteBookmarkData, DeleteBookmarkVars>(DELETE_BOOKMARK);

  // Sorted here, too: an update changes a position in the cache without refetching the list.
  const bookmarks = useMemo(
    () => [...(data?.bookmarks ?? [])].sort((a, b) => a.positionMs - b.positionMs || a.id - b.id),
    [data]
  );
  const { activeId, setActiveId } = useActiveBookmarkId(songId, spotifyTrack, bookmarks);

  /** Adds a bookmark and returns it. */
  const add = async (positionMs: number, label: string, endMs: number | null) => {
    const result = await addMutation({
      variables: {
        songId,
        spotifyTrack,
        positionMs: Math.round(positionMs),
        label,
        endMs: roundOrNull(endMs),
      },
      refetchQueries,
      awaitRefetchQueries: true,
    });
    if (!result.data) {
      throw new Error("Adding the bookmark returned no data.");
    }
    return result.data.addBookmark;
  };

  // Applied to the cache at once, so that quickly repeated shifts build on each other.
  const update = (bookmark: Bookmark) =>
    updateMutation({
      variables: {
        id: bookmark.id,
        positionMs: Math.round(bookmark.positionMs),
        label: bookmark.label,
        endMs: roundOrNull(bookmark.endMs),
      },
      optimisticResponse: { updateBookmark: { __typename: "Bookmark", ...bookmark } },
    });

  // The last deleted bookmark, which can be restored; tagged with its track, so that it isn't
  // offered for another one.
  const [removed, setRemoved] = useState<RemovedBookmark | null>(null);
  const lastRemoved = removed?.spotifyTrack === spotifyTrack ? removed : null;

  const remove = async (bookmark: Bookmark) => {
    const wasActive = bookmark.id === activeId;
    await deleteMutation({
      variables: { id: bookmark.id },
      refetchQueries,
      awaitRefetchQueries: true,
    });
    setRemoved({ bookmark, wasActive, spotifyTrack });
  };

  /** Adds the last deleted bookmark again, active again if it was. */
  const undoRemove = async () => {
    if (!lastRemoved) {
      return;
    }
    setRemoved(null);
    const { positionMs, label, endMs } = lastRemoved.bookmark;
    const restored = await add(positionMs, label, endMs);
    if (lastRemoved.wasActive) {
      setActiveId(restored.id);
    }
  };

  // Stable, so that a timer calling it isn't restarted on every render.
  const forgetRemoved = useCallback(() => setRemoved(null), []);

  return {
    bookmarks,
    activeId,
    setActiveId,
    add,
    update,
    remove,
    lastRemoved: lastRemoved?.bookmark ?? null,
    undoRemove,
    forgetRemoved,
  };
}
