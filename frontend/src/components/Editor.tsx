import {EditorContent, useEditor} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import React from "react";
import './Editor.css'

interface EditorProps {
    content: string
}


export default function Editor({content}: EditorProps) {
    const editor = useEditor({
        extensions: [StarterKit],
        content,
    })

    return <div className="editor-wrapper">
        <EditorContent editor={editor} className="editor"/>
    </div>
}
