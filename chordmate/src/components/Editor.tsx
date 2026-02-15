import { EditorContent, Extension, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Decoration, DecorationSet } from "prosemirror-view";
import { Plugin, PluginKey, EditorState } from "prosemirror-state";
import { useEffect, useRef } from "react";
import { detectChords, detectSectionHeader } from "../lib/analyzeLine.ts";

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

interface EditorProps {
  content: string;
  onUpdate?: (content: string) => void;
  editable: boolean;
}

export default function Editor({ content, onUpdate, editable }: EditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, ChordDecorations],
    content,
    onUpdate: ({ editor }) => onUpdate?.(editor.getText()),
    editable,
    parseOptions: {
      preserveWhitespace: "full",
    },
  });

  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);
  const editorScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing text
      const target = e.target as HTMLElement;

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        return;
      }

      if (!editorScrollRef.current) return;

      const SCROLL_STEP = 60;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        editorScrollRef.current.scrollBy({ top: SCROLL_STEP });
        console.log("DOWN");
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        editorScrollRef.current.scrollBy({ top: -SCROLL_STEP });
        console.log("UP");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div ref={editorScrollRef} className="h-full overflow-auto">
      <EditorContent
        editor={editor}
        className="text-current outline-none font-mono whitespace-pre"
      />
    </div>
  );
}
