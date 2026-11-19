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

export default function About() {
  return (
    <div className="w-full px-4 py-4 md:max-w-xl md:mx-auto flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">ChordMate</h1>
        <p>
          Chord sheets with a built-in Spotify player, for playing along with your songs on any
          device in your network.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Chord sheets</h2>
        <p>
          Write section names in brackets and put each chord line above its lyrics. ChordMate
          highlights both. Lines never wrap, so chords stay above their syllables; use{" "}
          <strong>Aa</strong> to adjust the font size or to switch to fullscreen.
        </p>
        <pre className="p-3 rounded bg-gray-100 dark:bg-gray-800 font-mono text-sm overflow-auto">
          {SHEET_EXAMPLE}
        </pre>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Keyboard shortcuts</h2>
        <p>On a song page, outside edit mode:</p>
        <table className="text-left">
          <tbody>
            {SHORTCUTS.map(([keys, action]) => (
              <tr key={keys} className="border-b border-gray-200 dark:border-gray-700">
                <td className="py-1 pr-4 font-mono whitespace-nowrap">{keys}</td>
                <td className="py-1">{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Spotify</h2>
        <p>
          Playback needs Spotify Premium. Log in once in a browser on the machine running the
          ChordMate server; all other devices then use that login automatically.
        </p>
      </section>
    </div>
  );
}
