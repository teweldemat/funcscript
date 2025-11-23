import React, { useRef, useEffect, useState } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';

function MinimalCodeMirror() {
  const editorRef = useRef(null);
  const [editorView, setEditorView] = useState<EditorView | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    const startState = EditorState.create({
      doc: "console.log('Hello CodeMirror 6!');",
      extensions: [
        keymap.of(defaultKeymap),
        javascript(),
        EditorView.theme(
          {
            '&': {
              fontFamily: '"Cascadia Code", "Fira Code", "Fira Mono", "Menlo", "Consolas", "Liberation Mono", "Courier New", monospace',
              fontWeight: 400,
              fontSize: '13px',
              height: '100%',
              backgroundColor: '#1e1e1e',
              color: '#d4d4d4'
            },
            '.cm-content': {
              padding: '16px 0'
            },
            '.cm-scroller': {
              overflow: 'auto',
              height: '100%'
            },
          },
          { dark: true }
        ),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    setEditorView(view);

    return () => {
      view.destroy();
      setEditorView(null);
    };
  }, []);

  return <div ref={editorRef} style={{ height: '300px' }} />;
}

export default MinimalCodeMirror;
