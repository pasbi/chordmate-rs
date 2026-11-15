import { EditorContent, Extension, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import { Plugin, PluginKey, EditorState } from "prosemirror-state";
import { useEffect, useRef, useState } from "react";
import { detectChords, detectSectionHeader } from "../lib/analyzeLine.ts";
import { isTypingTarget } from "../lib/isTypingTarget.ts";

function decorations(state: EditorState) {
  const decorations: Decoration[] = [];

  state.doc.descendants((node, pos) => {
    // Only process text blocks
    if (node.type.name !== "text") {
      return;
    }

    const text = node.textContent;
    const lines = text.split("\n");
    let offset = pos; // tracks position of the current line

    for (const line of lines) {
      const chordAnalysis = detectChords(line);
      if (chordAnalysis.isChordLine) {
        for (const match of chordAnalysis.matches) {
          const start = offset + match.start;
          const end = start + match.end - match.start + 1;
          decorations.push(Decoration.inline(start, end, { class: "chord-token" }));
        }
      }
      if (detectSectionHeader(line)) {
        decorations.push(
          Decoration.inline(offset, offset + line.length, { class: "section-header-token" })
        );
      }
      offset += line.length + 1; // +1 for the newline character
    }
  });

  return DecorationSet.create(state.doc, decorations);
}

const ChordDecorations = Extension.create({
  name: "chordDecorations",
  addProseMirrorPlugins(): Plugin[] {
    return [
      new Plugin({
        key: new PluginKey("chordDecorations"),
        props: {
          decorations,
        },
      }),
    ];
  },
});

/** Shown in an empty sheet while editing, to show the expected format. */
const PLACEHOLDER = `[Verse 1]
Am            F
Lyrics go here, chords
C             G
above the syllable they belong to.

[Chorus]
...`;

/**
 * Pastes clipboard contents as plain text. Text copied from websites otherwise arrives as HTML,
 * with formatting and paragraphs that break the chord sheet layout.
 */
function pasteAsPlainText(view: EditorView, event: ClipboardEvent) {
  const text = event.clipboardData?.getData("text/plain");
  if (!text) {
    return false;
  }
  view.dispatch(view.state.tr.insertText(text.replace(/\r\n?/g, "\n")));
  return true;
}

interface EditorProps {
  content: string;
  onUpdate?: (content: string) => void;
  editable: boolean;
  fontSize: number;
}

export default function Editor({ content, onUpdate, editable, fontSize }: EditorProps) {
  const [isEmpty, setIsEmpty] = useState(content.trim() === "");
  const editor = useEditor({
    extensions: [StarterKit, ChordDecorations],
    content,
    onUpdate: ({ editor }) => {
      setIsEmpty(editor.isEmpty);
      onUpdate?.(editor.getText());
    },
    editable,
    parseOptions: {
      preserveWhitespace: "full",
    },
    editorProps: {
      handlePaste: pasteAsPlainText,
    },
  });

  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);
  const editorScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) {
        return;
      }

      if (!editorScrollRef.current) return;

      const SCROLL_STEP = 60;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        editorScrollRef.current.scrollBy({ top: SCROLL_STEP });
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        editorScrollRef.current.scrollBy({ top: -SCROLL_STEP });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Lines never wrap: a wrapped lyric line would no longer line up with its chord line.
  const editModeClasses = editable
    ? "rounded ring-2 ring-blue-500/60 bg-blue-50/50 dark:bg-blue-950/30"
    : "";
  return (
    <div
      ref={editorScrollRef}
      className={`relative h-full overflow-auto p-2 ${editModeClasses}`}
      style={{ fontSize }}
    >
      {editable && isEmpty && (
        <pre className="absolute top-2 left-2 pointer-events-none font-mono text-gray-400 dark:text-gray-500">
          {PLACEHOLDER}
        </pre>
      )}
      <EditorContent editor={editor} className="chord-sheet text-current outline-none font-mono" />
    </div>
  );
}
