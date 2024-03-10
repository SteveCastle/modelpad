import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { PlusIcon } from "@heroicons/react/24/solid";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { ListItemNode, ListNode } from "@lexical/list";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { TRANSFORMERS } from "@lexical/markdown";

import { useDebouncedCallback } from "use-debounce";
import { useQuery } from "react-query";

import "./App.css";
import { FloatingMenuPlugin } from "./components/FloatingMenuPlugin";
import ContextMenu from "./components/ContextMenu";
import { useStore, Story } from "./store";
import { UpdateDocumentPlugin } from "./components/UpdateDocumentPlugin";
import { Tab } from "./components/Tab";
import { Toolbar } from "./components/Toolbar";
import { useEffect } from "react";
import CodeHighlightPlugin from "./components/CodeHighlightPlugin";

const theme = {
  ltr: "ltr",
  rtl: "rtl",
  placeholder: "editor-placeholder",
  input: "editor-input",
  paragraph: "editor-paragraph",
  blockquote: "editor-blockquote",
  quote: "editor-quote",
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

type Model = {
  name: string;
};

const editorConfig = {
  theme,
  namespace: "editor",
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
};

const getModels = (endpoint: string) => async () => {
  const res = await fetch(`${endpoint}/tags`);
  return res.json();
};

function App() {
  const {
    setActive,
    closeStory,
    createStory,
    updateStory,
    setAvailableModels,
    stories,
    cancelGeneration,
  } = useStore((state) => state);

  const activeStoryId = useStore((state) => state.activeStoryId);
  const debouncedOnChange = useDebouncedCallback(
    (state) => {
      updateStory(activeStoryId, state);
    },
    1000,
    {
      maxWait: 1000,
    }
  );
  const activeStory = stories.find((s) => s.id === activeStoryId);
  const activeContent =
    activeStory && activeStory.content
      ? JSON.stringify(activeStory.content)
      : undefined;

  // If activeStory changes cancel generation
  useEffect(() => {
    cancelGeneration();
  }, [activeStoryId, cancelGeneration]);
  const endpoint = useStore((state) => state.modelSettings.endpoint);
  const { data } = useQuery({
    queryKey: ["models", endpoint],
    queryFn: getModels(endpoint),
    onSuccess: (data) => {
      const modelNames = data.models.map((model: Model) => model.name);
      setAvailableModels(modelNames);
    },
  });

  if (!data) return <div>Loading...</div>;

  return (
    <div className="App">
      <div className="tabs">
        {stories.map((story: Story) => (
          <Tab
            key={story.id}
            story={story}
            activeStoryId={activeStoryId}
            setActive={setActive}
            closeStory={closeStory}
          />
        ))}
        <div className="add">
          <button className="button" onClick={() => createStory("Untitled")}>
            <PlusIcon />
          </button>
        </div>
      </div>
      <LexicalComposer
        initialConfig={{
          ...editorConfig,
          editorState: activeContent,
        }}
      >
        <Toolbar />
        <RichTextPlugin
          contentEditable={<ContentEditable className="editor-input" />}
          placeholder={null}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <FloatingMenuPlugin MenuComponent={ContextMenu} />
        <HistoryPlugin />
        <OnChangePlugin onChange={debouncedOnChange} ignoreSelectionChange />
        <UpdateDocumentPlugin
          activeContent={activeContent}
          activeStoryId={activeStoryId}
        />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        <ListPlugin />
        <LinkPlugin />
        <CodeHighlightPlugin />
      </LexicalComposer>
    </div>
  );
}

export default App;
