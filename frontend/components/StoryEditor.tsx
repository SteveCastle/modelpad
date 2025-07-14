import { useMemo } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { ListItemNode, ListNode } from "@lexical/list";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "./LexicalMarkdownShortcutPlugin";
import { TRANSFORMERS } from "@lexical/markdown";
import { useDebouncedCallback } from "use-debounce";
import { FloatingMenuPlugin } from "./FloatingMenuPlugin";
import ContextMenu from "./ContextMenu";
import CodeHighlightPlugin from "./CodeHighlightPlugin";
import { Toolbar } from "./Toolbar";
import { useStore, Story } from "../store";

const theme = {
  ltr: "ltr",
  rtl: "rtl",
  placeholder: "editor-placeholder",
  input: "editor-input",
  paragraph: "editor-paragraph",
  blockquote: "editor-blockquote",
  quote: "editor-quote",
  link: "editor-link",
  heading: {
    h1: "editor-heading-h1",
    h2: "editor-heading-h2",
    h3: "editor-heading-h3",
    h4: "editor-heading-h4",
    h5: "editor-heading-h5",
  },
  list: {
    nested: {
      listitem: "editor-nested-listitem",
    },
    ol: "editor-list-ol",
    ul: "editor-list-ul",
    listitem: "editor-listitem",
  },
  text: {
    bold: "editor-text-bold",
    italic: "editor-text-italic",
    overflowed: "editor-text-overflowed",
    hashtag: "editor-text-hashtag",
    underline: "editor-text-underline",
    strikethrough: "editor-text-strikethrough",
    underlineStrikethrough: "editor-text-underlineStrikethrough",
    code: "editor-text-code",
  },
  code: "codeHighlight",
  codeHighlight: {
    atrule: "editor-tokenAttr",
    attr: "editor-tokenAttr",
    boolean: "editor-tokenProperty",
    builtin: "editor-tokenSelector",
    cdata: "editor-tokenComment",
    char: "editor-tokenSelector",
    class: "editor-tokenFunction",
    "class-name": "editor-tokenFunction",
    comment: "editor-tokenComment",
    constant: "editor-tokenProperty",
    deleted: "editor-tokenProperty",
    doctype: "editor-tokenComment",
    entity: "editor-tokenOperator",
    function: "editor-tokenFunction",
    important: "editor-tokenVariable",
    inserted: "editor-tokenSelector",
    keyword: "editor-tokenAttr",
    namespace: "editor-tokenVariable",
    number: "editor-tokenProperty",
    operator: "editor-tokenOperator",
    prolog: "editor-tokenComment",
    property: "editor-tokenProperty",
    punctuation: "editor-tokenPunctuation",
    regex: "editor-tokenVariable",
    selector: "editor-tokenSelector",
    string: "editor-tokenSelector",
    symbol: "editor-tokenProperty",
    tag: "editor-tokenProperty",
    url: "editor-tokenOperator",
    variable: "editor-tokenVariable",
  },
};

interface StoryEditorProps {
  story: Story;
  isActive: boolean;
  viewSettings: {
    readingMode: boolean;
    zoom: number;
  };
}

export function StoryEditor({
  story,
  isActive,
  viewSettings,
}: StoryEditorProps) {
  const { updateStory, updateSyncState } = useStore((state) => state);

  const initialContent = story.content
    ? JSON.stringify(story.content)
    : undefined;

  const editorConfig = useMemo(
    () => ({
      theme,
      namespace: `editor-${story.id}`,
      onError(error: Error) {
        throw error;
      },
      nodes: [
        HeadingNode,
        ListNode,
        ListItemNode,
        QuoteNode,
        CodeNode,
        CodeHighlightNode,
        TableNode,
        TableCellNode,
        TableRowNode,
        AutoLinkNode,
        LinkNode,
      ],
      editorState: initialContent,
    }),
    [story.id, initialContent]
  );

  const debouncedOnChange = useDebouncedCallback(
    (editorState) => {
      const content = JSON.stringify(editorState);
      if (content !== initialContent) {
        updateStory(story.id, editorState);
        updateSyncState(story.id, false);
      }
    },
    1000,
    {
      maxWait: 1000,
    }
  );

  return (
    <LexicalComposer initialConfig={editorConfig}>
      {isActive && <Toolbar />}
      <div
        style={{
          display: isActive ? "block" : "none",
          width: "100%",
          boxSizing: "border-box",
          maxWidth: viewSettings.readingMode ? "960px" : "",
          margin: viewSettings.readingMode ? "0 auto" : "0 20px",
          padding: viewSettings.readingMode ? "20px" : "0",
          overflow: "hidden",
          fontSize: `${viewSettings.zoom}em`,
        }}
      >
        <RichTextPlugin
          contentEditable={<ContentEditable className="editor-input" />}
          placeholder={null}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <FloatingMenuPlugin MenuComponent={ContextMenu} />
        <HistoryPlugin />
        <OnChangePlugin
          onChange={debouncedOnChange}
          ignoreSelectionChange
          ignoreHistoryMergeTagChange
        />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        <ListPlugin />
        <LinkPlugin />
        <CodeHighlightPlugin />
      </div>
    </LexicalComposer>
  );
}
