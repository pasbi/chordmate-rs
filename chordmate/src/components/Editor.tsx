import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlock from "@tiptap/extension-code-block";
import { useEffect } from "react";

interface EditorProps {
  content: string;
  onUpdate?: (content: string) => void;
  editable: boolean;
}

export default function Editor({ content, onUpdate, editable }: EditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, CodeBlock],
    content: `<pre>${content}</pre>`,
    onUpdate: ({ editor }) => {
      onUpdate?.(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.setEditable(!!editable);
  }, [editor, editable]);

  return (
    <EditorContent
      editor={editor}
      className="
    flex-1
    min-h-0
    text-current
    outline-none
  "
    />
  );
}
