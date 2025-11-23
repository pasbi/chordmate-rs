import {EditorContent, useEditor} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import React from "react";
import './Editor.css'

interface EditorProps {
    content: string
    onUpdate?: (content: string) => void
}


export default function Editor({content, onUpdate}: EditorProps) {
    const editor = useEditor({
        extensions: [StarterKit],
        content,
        onUpdate: ({editor}) => {
            onUpdate?.(editor.getHTML())
        },
    })

    return <div className="editor-wrapper">
        <EditorContent editor={editor} className="editor"/>
    </div>
}
