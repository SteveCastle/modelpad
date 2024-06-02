import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";

const emptyState = JSON.stringify({
  root: {
    children: [
      {
        children: [],
        direction: null,
        format: "",
        indent: 0,
        type: "paragraph",
        version: 1,
      },
    ],
    direction: null,
    format: "",
    indent: 0,
    type: "root",
    version: 1,
  },
});

export function UpdateDocumentPlugin({
  activeContent,
  activeStoryId,
  updateId,
}: {
  activeContent: string | undefined;
  activeStoryId: string;
  updateId: number;
}) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const editorState = editor.parseEditorState(activeContent || emptyState);
    editor.setEditorState(editorState);
  }, [activeStoryId, editor, updateId]);

  return null;
}
