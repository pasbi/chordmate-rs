import { TextPage } from "./TextPage.tsx";

const SHORTCUTS: [string, string][] = [
  ["Space", "Play / pause"],
  ["← / →", "Back / forward 1 s"],
  ["Ctrl + ← / Ctrl + →", "Back / forward 10 s"],
  ["B", "Add a bookmark here"],
  ["E", "Set the active bookmark's loop end here"],
  ["R", "Back to the active bookmark"],
  ["L", "Loop on / off (play on past the loop end)"],
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
        <h2 className="text-lg font-semibold">Auto-scroll</h2>
        <p>
          While a song plays, the sheet can follow the music: when playback starts, an{" "}
          <strong>Auto-scroll</strong> button appears below the sheet for a few seconds; a{" "}
          <strong>▶</strong> at a heading switches it on as well. To make it follow the song's
          sections, tap <strong>Anchor to</strong> (with the current time) beside a section's
          heading as that section starts playing, or with the song paused right there. The sheet
          then glides from heading to heading. Without any anchors, it scrolls in proportion to the
          song's progress.
        </p>
        <p>
          An anchored heading shows its time with an anchor: tap it to fine-tune the time (each step
          plays from it), anchor it anew, or remove it. <strong>▶</strong> left of the heading plays
          from there. To sync a song from scratch, use <strong>Clear all anchors</strong> in the{" "}
          <strong>☰</strong> menu while editing.
        </p>
        <p>
          Scrolling by hand switches it off, and the <strong>Auto-scroll</strong> button appears
          again for a few seconds. It stays as last set for the next songs on this device.
        </p>
        <p>
          The section playing is highlighted, so you can see how well the sheet keeps up. Sections
          you haven't set are estimated, so their highlight may come early or late.
        </p>
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
