import { EditorContent, Extension, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlock from "@tiptap/extension-code-block";
import { Decoration, DecorationSet } from "prosemirror-view";
import { Plugin, PluginKey, EditorState } from "prosemirror-state";
import { useEffect } from "react";

const CHORD_REGEX =
  /\b([A-G](?:#|b)?(?:m|maj|min|dim|aug|sus2|sus4)?\d*(?:add\d+)?(?:\/[A-G](?:#|b)?)?)(?![a-zA-Z0-9_])/g;

function analyzeLine(text: string) {
  const matches = [...text.matchAll(CHORD_REGEX)];
  let score = 0;
  if (matches.length >= 2) score += 3;
  if (/[-|/]/.test(text)) score += 2;
  if (!/[a-z]/.test(text)) score += 2;
  if (/[.,;]/.test(text)) score -= 2;

  return {
    isChordLine: score >= 3,
    matches,
  };
}

function decorations(state: EditorState) {
  const decorations: Decoration[] = [];

  state.doc.descendants((node, pos) => {
    // Only process text blocks
    console.log(`descendants ${node.type.name} ${pos}`);
    if (node.type.name !== "text") {
      return;
    }

    const text = node.textContent;
    const lines = text.split("\n");
    let offset = pos; // tracks position of the current line

    for (const line of lines) {
      const analysis = analyzeLine(line);
      if (!analysis.isChordLine) {
        continue;
      }

      for (const match of analysis.matches) {
        if (match.index == null) {
          continue;
        }
        const start = offset + match.index;
        const end = start + match[0].length;
        decorations.push(Decoration.inline(start, end, { class: "chord-token" }));
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
    extensions: [StarterKit, CodeBlock, ChordDecorations],
    content,
    onUpdate: ({ editor }) => onUpdate?.(editor.getText()),
    editable,
  });

  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);

  return (
    <EditorContent
      editor={editor}
      className="flex-1 min-h-0 text-current outline-none font-mono whitespace-pre overflow-y-auto"
    />
  );
}
