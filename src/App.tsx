import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { PlusIcon } from "@heroicons/react/24/solid";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useDebouncedCallback } from "use-debounce";

import "./App.css";
import { FloatingMenuPlugin } from "./components/FloatingMenuPlugin";
import ContextMenu from "./components/ContextMenu";
import { useStore, Story } from "./store";
import { UpdateDocumentPlugin } from "./components/UpdateDocumentPlugin";
import { Tab } from "./components/Tab";
import { Toolbar } from "./components/Toolbar";

const theme = {
  ltr: "ltr",
  rtl: "rtl",
  placeholder: "editor-placeholder",
  input: "editor-input",
  paragraph: "editor-paragraph",
};

const editorConfig = {
  theme,
  namespace: "editor",
  onError(error: Error) {
    throw error;
  },
  nodes: [],
};

function App() {
  const { setActive, closeStory, createStory, updateStory, stories } = useStore(
    (state) => state
  );

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

  return (
    <div className="App">
      <div className="tabs">
        {stories.map((story: Story) => (
          <Tab
            story={story}
            activeStoryId={activeStoryId}
            setActive={setActive}
            closeStory={closeStory}
          />
        ))}
        <div className="add">
          <button className="button" onClick={() => createStory()}>
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
      </LexicalComposer>
    </div>
  );
}

export default App;
