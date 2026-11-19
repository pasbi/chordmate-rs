import { EditorContent, Extension, type JSONContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { closeHistory } from "@tiptap/pm/history";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import { Plugin, PluginKey, EditorState } from "prosemirror-state";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { analyzeSourceLine } from "../lib/chordPro.ts";
import {
  normalizeSongContent,
  shouldConvertPaste,
  ultimateGuitarToChordPro,
} from "../lib/ultimateGuitar.ts";
import { isTypingTarget } from "../lib/isTypingTarget.ts";
import ChordSheet from "./ChordSheet.tsx";

/** Decorations that highlight the ChordPro markup of one source line starting at `offset`. */
function lineDecorations(line: string, offset: number) {
  const analysis = analyzeSourceLine(line);
  if (analysis.kind !== "lyrics") {
    const className = analysis.kind === "heading" ? "section-header-token" : "directive-token";
    return [Decoration.inline(offset, offset + line.length, { class: className })];
  }
  return analysis.marks.map((mark) =>
    Decoration.inline(offset + mark.start, offset + mark.end, {
      class: mark.chord.isAnnotation ? "chord-annotation" : "chord-token",
    })
  );
}

function decorations(state: EditorState) {
  const result: Decoration[] = [];
  state.doc.descendants((node, pos) => {
    if (!node.isText) {
      return;
    }
    let offset = pos;
    for (const line of (node.text ?? "").split("\n")) {
      result.push(...lineDecorations(line, offset));
      offset += line.length + 1; // +1 for the newline character
    }
  });
  return DecorationSet.create(state.doc, result);
}

const ChordProHighlighting = Extension.create({
  name: "chordProHighlighting",
  addProseMirrorPlugins(): Plugin[] {
    return [new Plugin({ key: new PluginKey("chordProHighlighting"), props: { decorations } })];
  },
});

/** The sheet is plain text: no formatting, lists or headings, which input rules would create. */
const PlainTextKit = StarterKit.configure({
  blockquote: false,
  bold: false,
  bulletList: false,
  code: false,
  codeBlock: false,
  heading: false,
  horizontalRule: false,
  italic: false,
  link: false,
  listItem: false,
  listKeymap: false,
  orderedList: false,
  strike: false,
  underline: false,
});

/** One paragraph per line, so that the text is never parsed as HTML. */
function toDocument(text: string): JSONContent {
  return {
    type: "doc",
    content: text
      .split("\n")
      .map((line) =>
        line === ""
          ? { type: "paragraph" }
          : { type: "paragraph", content: [{ type: "text", text: line }] }
      ),
  };
}

/** Shown in an empty sheet while editing, to show the expected format. */
const PLACEHOLDER = `{c: Verse 1}
[Am]Chords go in brackets, [F]right before
the [C]syllable they be[G]long to.

{c: Chorus}
...

Chords above lyrics, as pasted from Ultimate Guitar,
are converted automatically.`;

/**
 * Pastes clipboard contents as plain text; text copied from websites otherwise arrives as HTML.
 * Chords-over-lyrics text is then converted to ChordPro in a separate undo step, so that undoing
 * once restores the text as pasted.
 */
function pastePlainText(view: EditorView, event: ClipboardEvent, onConverted: () => void) {
  const pasted = event.clipboardData?.getData("text/plain");
  if (!pasted) {
    return false;
  }
  const text = pasted.replace(/\r\n?/g, "\n");
  const { from } = view.state.selection;
  view.dispatch(view.state.tr.insertText(text));
  if (shouldConvertPaste(text)) {
    const converted = ultimateGuitarToChordPro(text);
    if (converted !== text) {
      view.dispatch(closeHistory(view.state.tr.insertText(converted, from, from + text.length)));
      onConverted();
    }
  }
  return true;
}

const NOTICE_BUTTON_CLASSES =
  "rounded px-2 py-1 font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50";

interface EditorProps {
  content: string;
  onUpdate?: (content: string) => void;
  editable: boolean;
  fontSize: number;
  /** Semitones the rendered sheet's chords are shifted by; the source is edited as written. */
  transpose: number;
}

/** The song sheet: ChordPro source while editing, the rendered sheet otherwise. */
export default function Editor({ content, onUpdate, editable, fontSize, transpose }: EditorProps) {
  // Songs saved in an earlier format are shown, and edited, as ChordPro.
  const [text, setText] = useState(() => normalizeSongContent(content));
  const [isEmpty, setIsEmpty] = useState(text.trim() === "");
  const [pasteConverted, setPasteConverted] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const editor = useEditor({
    extensions: [PlainTextKit, ChordProHighlighting],
    content: toDocument(text),
    onUpdate: ({ editor }) => {
      const updated = editor.getText({ blockSeparator: "\n" });
      setText(updated);
      setIsEmpty(editor.isEmpty);
      setPasteConverted(false);
      onUpdate?.(updated);
    },
    onSelectionUpdate: ({ editor }) => setHasSelection(!editor.state.selection.empty),
    editable,
    editorProps: {
      handlePaste: (view, event) => pastePlainText(view, event, () => setPasteConverted(true)),
    },
  });

  useEffect(() => {
    // Without an update event: switching modes does not change the text.
    editor.setEditable(editable, false);
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

  /** Converts selected chords-over-lyrics text, e.g. when pasting did not recognize it. */
  const convertSelection = () => {
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to, "\n");
    editor.view.dispatch(editor.state.tr.insertText(ultimateGuitarToChordPro(selected), from, to));
    editor.commands.focus();
  };

  const editModeClasses = editable
    ? "rounded ring-2 ring-blue-500/60 bg-blue-50/50 dark:bg-blue-950/30"
    : "";
  // Keeps the editor's focus and selection when clicking the bar's buttons.
  const keepFocus = (event: MouseEvent) => event.preventDefault();
  return (
    <div className="relative h-full">
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
        {/* Stays mounted outside edit mode, so that the editor keeps its state and history. */}
        <EditorContent
          editor={editor}
          className={`chord-sheet text-current outline-none font-mono ${editable ? "" : "hidden"}`}
        />
        {!editable && <ChordSheet source={text} transpose={transpose} />}
      </div>
      {editable && (pasteConverted || hasSelection) && (
        <div className="absolute bottom-3 right-3 flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm shadow-lg">
          {pasteConverted ? (
            <>
              <span>Converted chords above lyrics to ChordPro.</span>
              <button
                type="button"
                className={NOTICE_BUTTON_CLASSES}
                onMouseDown={keepFocus}
                onClick={() => editor.commands.undo()}
              >
                Undo
              </button>
            </>
          ) : (
            <button
              type="button"
              className={NOTICE_BUTTON_CLASSES}
              onMouseDown={keepFocus}
              onClick={convertSelection}
              title="Moves chords from the lines above lyrics into the lyrics, in brackets"
            >
              Convert chords above lyrics
            </button>
          )}
        </div>
      )}
    </div>
  );
}
