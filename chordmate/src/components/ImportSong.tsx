import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GET_SONGS } from "../graphql";
import { useSheetFontSize } from "../hooks/useSheetFontSize";
import { bookmarkletUrl, type ImportedSong, parseImportFragment } from "../lib/songImport.ts";
import { wrapTranspose } from "../lib/transpose.ts";
import { ultimateGuitarToChordPro } from "../lib/ultimateGuitar.ts";
import type Song from "../types/Song.ts";
import Button from "./Button.tsx";
import ChordSheet from "./ChordSheet.tsx";
import { INPUT_CLASSES } from "./inputClasses.ts";
import { TextPage } from "./TextPage.tsx";
import { isSaveShortcut } from "../lib/isTypingTarget.ts";

const ADD_SONG = gql`
  mutation AddSong {
    addSong
  }
`;
const UPDATE_SONG_META = gql`
  mutation ImportSongMeta($id: Int!, $title: String!, $artist: String!) {
    updateSongMeta(id: $id, title: $title, artist: $artist, albumArtUrl: null, bpm: null)
  }
`;
const UPDATE_SONG_CONTENT = gql`
  mutation ImportSongContent($id: Int!, $content: String!) {
    updateSongContent(id: $id, content: $content)
  }
`;
const UPDATE_SONG_TRANSPOSE = gql`
  mutation ImportSongTranspose($id: Int!, $transpose: Int!) {
    updateSongTranspose(id: $id, transpose: $transpose) {
      id
      transpose
    }
  }
`;

interface AddSongData {
  addSong: number;
}
interface GetSongsData {
  songs: Song[];
}

function normalizedName(text: string) {
  return text.trim().toLocaleLowerCase();
}

/** A song already in the library with the same title and artist, if any. */
function findExisting(songs: Song[], title: string, artist: string) {
  return (
    songs.find(
      (song) =>
        normalizedName(song.title) === normalizedName(title) &&
        normalizedName(song.artist) === normalizedName(artist)
    ) ?? null
  );
}

/** Creates the song and returns its id. */
function useCreateSong() {
  const [addSong] = useMutation<AddSongData>(ADD_SONG);
  const [updateMeta] = useMutation(UPDATE_SONG_META);
  const [updateContent] = useMutation(UPDATE_SONG_CONTENT);
  const [updateTranspose] = useMutation(UPDATE_SONG_TRANSPOSE);
  return async (title: string, artist: string, content: string, transpose: number) => {
    const added = await addSong({ refetchQueries: [{ query: GET_SONGS }] });
    const id = added.data?.addSong;
    if (id === undefined) {
      throw new Error("Adding the song returned no id.");
    }
    await updateMeta({ variables: { id, title, artist } });
    await updateContent({ variables: { id, content } });
    if (transpose !== 0) {
      await updateTranspose({ variables: { id, transpose } });
    }
    return id;
  };
}

/**
 * The bookmarklet to drag to the bookmarks toolbar. React refuses to render a `javascript:`
 * address, so the link gets it directly on its element.
 */
function BookmarkletLink() {
  const setAddress = useCallback((link: HTMLAnchorElement | null) => {
    link?.setAttribute("href", bookmarkletUrl(window.location.origin));
  }, []);
  return (
    <a
      ref={setAddress}
      onClick={(event) => {
        event.preventDefault();
        window.alert("Drag this link to your bookmarks toolbar, then use it on Ultimate Guitar.");
      }}
      className="self-start px-3 py-2 rounded bg-blue-500 text-white font-medium cursor-grab"
    >
      Send to ChordMate
    </a>
  );
}

/** Without a song to import: how to set up and use the bookmarklet. */
function ImportSetup() {
  return (
    <section className="flex flex-col gap-2">
      <p>
        Drag this link to your browser's bookmarks toolbar. On an Ultimate Guitar chords page, click
        the bookmark: ChordMate opens with the song, ready to check and create. Chords written for a
        capo are transposed to match the recording.
      </p>
      <BookmarkletLink />
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Works in desktop browsers; Firefox for Android doesn't run bookmarks like this one.
      </p>
    </section>
  );
}

/**
 * Shows a song sent by the bookmarklet (see lib/songImport.ts) for a check, and creates it. Its
 * sheet is converted to ChordPro; chords written for a capo are transposed by it, so that they
 * match the recording. The new song's page then offers to link its Spotify track.
 */
function ImportForm({ imported }: { imported: ImportedSong }) {
  const navigate = useNavigate();
  const { fontSize } = useSheetFontSize();
  const { data } = useQuery<GetSongsData>(GET_SONGS);
  const createSong = useCreateSong();
  const [title, setTitle] = useState(imported.title);
  const [artist, setArtist] = useState(imported.artist);
  const [creating, setCreating] = useState(false);

  const content = useMemo(() => ultimateGuitarToChordPro(imported.content), [imported.content]);
  const transpose = wrapTranspose(imported.capo);
  const existing = findExisting(data?.songs ?? [], title, artist);

  const canCreate = !creating && title.trim() !== "";
  const create = async () => {
    if (!canCreate) {
      return;
    }
    setCreating(true);
    try {
      const id = await createSong(title.trim(), artist.trim(), content, transpose);
      navigate(`/songs/${id}`, { replace: true });
    } catch (err) {
      console.error(err);
      window.alert("Creating the song failed.");
      setCreating(false);
    }
  };

  // Enter or Ctrl+S creates the song, also from the title and artist fields. Enter on a button or
  // link keeps activating that instead. Subscribed anew on every render, for the current fields.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const onControl =
        event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement;
      const plainEnter =
        event.key === "Enter" && !event.ctrlKey && !event.metaKey && !event.altKey && !onControl;
      if (plainEnter || isSaveShortcut(event)) {
        event.preventDefault();
        void create();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[auto_1fr] items-center gap-2 max-w-xl">
        <label htmlFor="import-title" className="text-sm font-medium">
          Title
        </label>
        <input
          id="import-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={INPUT_CLASSES}
        />
        <label htmlFor="import-artist" className="text-sm font-medium">
          Artist
        </label>
        <input
          id="import-artist"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          className={INPUT_CLASSES}
        />
      </div>
      {imported.capo !== 0 && (
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Written for capo {imported.capo}: the chords are transposed by{" "}
          {transpose > 0 ? `+${transpose}` : `−${-transpose}`} to match the recording.
        </p>
      )}
      {existing && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          “{existing.title}” by {existing.artist} is in your songs already.{" "}
          <Link to={`/songs/${existing.id}`} className="underline">
            Open it
          </Link>
        </p>
      )}
      <div className="flex gap-2">
        <Button
          variant="primary"
          title="Create song (Enter or Ctrl+S)"
          disabled={!canCreate}
          onClick={() => void create()}
        >
          Create song
        </Button>
        <Button variant="secondary" onClick={() => navigate("/songs")}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        From{" "}
        <a href={imported.sourceUrl} target="_blank" rel="noreferrer" className="underline">
          {imported.sourceUrl}
        </a>
      </p>
      <div className="p-2 rounded border border-gray-200 dark:border-gray-700" style={{ fontSize }}>
        <ChordSheet source={content} transpose={transpose} spelling="common" sections={null} />
      </div>
    </div>
  );
}

export default function ImportSong() {
  // Read once: the fragment holds the whole song and doesn't change while the page is open.
  const [imported] = useState(() => parseImportFragment(window.location.hash));
  return (
    <TextPage title="Import from Ultimate Guitar">
      {imported ? <ImportForm imported={imported} /> : <ImportSetup />}
    </TextPage>
  );
}
