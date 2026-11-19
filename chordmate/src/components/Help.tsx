import { TextPage } from "./TextPage.tsx";

const SHORTCUTS: [string, string][] = [
  ["Space", "Play / pause"],
  ["← / →", "Back / forward 1 s"],
  ["Ctrl + ← / Ctrl + →", "Back / forward 10 s"],
  ["B", "Add a bookmark here"],
  ["E", "Set the active bookmark's loop end here"],
  ["R", "Back to the active bookmark"],
  ["↑ / ↓", "Scroll the chord sheet"],
  ["Esc", "Close a dialog"],
];

const SHEET_EXAMPLE = `[Chorus]
C           G
Chords stand above
Am          F
the lyrics they belong to`;

const EDITING_SHORTCUTS: [string, string][] = [
  ["Enter / Ctrl + S", "Import page: create the song"],
  ["Enter", "Spotify search: pick the highlighted track"],
  ["↑ / ↓", "Spotify search: move the highlight"],
  ["Ctrl + S", "Edit mode: save and finish editing"],
];

function ShortcutTable({ shortcuts }: { shortcuts: [string, string][] }) {
  return (
    <table className="text-left">
      <tbody>
        {shortcuts.map(([keys, action]) => (
          <tr key={keys + action} className="border-b border-gray-200 dark:border-gray-700">
            <td className="py-1 pr-4 font-mono whitespace-nowrap">{keys}</td>
            <td className="py-1">{action}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** How to write chord sheets and use the player; setting up Spotify. */
export default function Help() {
  return (
    <TextPage title="Help">
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Chord sheets</h2>
        <p>
          Write section names in brackets and put each chord line above its lyrics. ChordMate
          highlights both. Lines never wrap, so chords stay above their syllables; use the song's{" "}
          <strong>☰</strong> menu to adjust the font size, transpose or switch to fullscreen.
        </p>
        <pre className="p-3 rounded bg-gray-100 dark:bg-gray-800 font-mono text-sm overflow-auto">
          {SHEET_EXAMPLE}
        </pre>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Keyboard shortcuts</h2>
        <p>On a song page, outside edit mode:</p>
        <ShortcutTable shortcuts={SHORTCUTS} />
        <p>Adding songs and editing:</p>
        <ShortcutTable shortcuts={EDITING_SHORTCUTS} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Spotify</h2>
        <p>
          Playback needs Spotify Premium. Log in once in a browser on the machine running the
          ChordMate server; all other devices then use that login automatically.
        </p>
      </section>
    </TextPage>
  );
}
