import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlock from "@tiptap/extension-code-block";

interface EditorProps {
  content: string;
  onUpdate?: (content: string) => void;
}

export default function Editor({ content, onUpdate }: EditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, CodeBlock],
    content: `<pre>${content}</pre>`,
    onUpdate: ({ editor }) => {
      onUpdate?.(editor.getHTML());
    },
  });

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
