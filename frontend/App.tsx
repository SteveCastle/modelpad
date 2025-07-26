import { useEffect, useRef, useState } from "react";
import { PlusIcon } from "@heroicons/react/24/solid";
import { useQuery } from "react-query";
import { EmailPasswordPreBuiltUI } from "supertokens-auth-react/recipe/emailpassword/prebuiltui";
import { canHandleRoute, getRoutingComponent } from "supertokens-auth-react/ui";
import {
  PanelGroup,
  Panel,
  PanelResizeHandle,
  ImperativePanelHandle,
} from "react-resizable-panels";
import { useStore, Story } from "./store";
import { StoryEditor } from "./components/StoryEditor";
import { Tab } from "./components/Tab";
import { providers } from "./providers";
import "./App.css";
import { useSessionContext } from "supertokens-auth-react/recipe/session";
import Notes from "./components/Notes";
import AIPanel from "./components/AIPanel";

type Model = {
  name: string;
};

// Custom hook to detect mobile screen size
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);

    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  return isMobile;
}

// Props interfaces for navigation components
interface LeftNavBarProps {
  leftPanelRef: React.RefObject<ImperativePanelHandle>;
  setActiveNotesTab: (tab: "notes" | "vocabulary") => void;
  activeNotesTab: "notes" | "vocabulary";
  leftPanelCollapsed: boolean;
}

interface RightNavBarProps {
  rightPanelRef: React.RefObject<ImperativePanelHandle>;
  setActiveAITab: (tab: "model-settings" | "context-control" | "agent") => void;
  activeAITab: "model-settings" | "context-control" | "agent";
  rightPanelCollapsed: boolean;
}

// Vertical Navigation Components (defined outside App to prevent re-creation)
const LeftNavBar = ({
  leftPanelRef,
  setActiveNotesTab,
  activeNotesTab,
  leftPanelCollapsed,
}: LeftNavBarProps) => (
  <div className="vertical-nav-bar left multiple-buttons">
    <button
      className="nav-button"
      onClick={() => {
        if (!leftPanelCollapsed && activeNotesTab === "notes") {
          leftPanelRef.current?.collapse();
        } else {
          setActiveNotesTab("notes");
          leftPanelRef.current?.expand();
        }
      }}
      title="Notes"
    >
      <span className="nav-icon">📝</span>
      <span className="nav-label">Notes</span>
    </button>
    <button
      className="nav-button"
      onClick={() => {
        if (!leftPanelCollapsed && activeNotesTab === "vocabulary") {
          leftPanelRef.current?.collapse();
        } else {
          setActiveNotesTab("vocabulary");
          leftPanelRef.current?.expand();
        }
      }}
      title="Vocabulary"
    >
      <span className="nav-icon">📚</span>
      <span className="nav-label">Vocabulary</span>
    </button>
  </div>
);

const RightNavBar = ({
  rightPanelRef,
  setActiveAITab,
  activeAITab,
  rightPanelCollapsed,
}: RightNavBarProps) => (
  <div className="vertical-nav-bar right multiple-buttons">
    <button
      className="nav-button"
      onClick={() => {
        if (!rightPanelCollapsed && activeAITab === "model-settings") {
          rightPanelRef.current?.collapse();
        } else {
          setActiveAITab("model-settings");
          rightPanelRef.current?.expand();
        }
      }}
      title="Model Settings"
    >
      <span className="nav-icon">⚙️</span>
      <span className="nav-label">Model</span>
    </button>
    <button
      className="nav-button"
      onClick={() => {
        if (!rightPanelCollapsed && activeAITab === "context-control") {
          rightPanelRef.current?.collapse();
        } else {
          setActiveAITab("context-control");
          rightPanelRef.current?.expand();
        }
      }}
      title="Context Control"
    >
      <span className="nav-icon">📄</span>
      <span className="nav-label">Context</span>
    </button>
    <button
      className="nav-button"
      onClick={() => {
        if (!rightPanelCollapsed && activeAITab === "agent") {
          rightPanelRef.current?.collapse();
        } else {
          setActiveAITab("agent");
          rightPanelRef.current?.expand();
        }
      }}
      title="AI Agent"
    >
      <span className="nav-icon">🤖</span>
      <span className="nav-label">Agent</span>
    </button>
  </div>
);

function App() {
  const {
    setActive,
    createStory,
    setAvailableModels,
    setGenerationState,
    stories,
    cancelGeneration,
    viewSettings,
    generationState,
    migrateTags,
  } = useStore((state) => state);
  const session = useSessionContext();
  const { providerKey, host } = useStore(
    (state) => state.availableServers[state.serverKey]
  );
  const provider = providers[providerKey];
  const activeStoryId = useStore((state) => state.activeStoryId);
  const isMobile = useIsMobile();

  // Panel refs and state
  const leftPanelRef = useRef<ImperativePanelHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [activeAITab, setActiveAITab] = useState<
    "model-settings" | "context-control" | "agent"
  >("model-settings");
  const [activeNotesTab, setActiveNotesTab] = useState<"notes" | "vocabulary">(
    "notes"
  );

  // If activeStory changes cancel generation
  useEffect(() => {
    if (generationState !== "ready") {
      cancelGeneration();
    }
  }, [activeStoryId]);

  // Reset panel states when switching between mobile and desktop
  useEffect(() => {
    setLeftPanelCollapsed(false);
    setRightPanelCollapsed(false);
  }, [isMobile]);

  // Migrate existing tags to new hierarchical format on app startup
  useEffect(() => {
    migrateTags();
  }, [migrateTags]);

  useQuery({
    queryKey: ["models", host],
    queryFn: provider.getModels(host),
    onError: () => {
      setGenerationState("no-connection");
      setAvailableModels([]);
    },
    onSuccess: (data) => {
      const modelNames = data.models.map((model: Model) => model.name);
      setAvailableModels(modelNames);
    },
  });

  if (canHandleRoute([EmailPasswordPreBuiltUI])) {
    // This renders the login UI on the /auth route
    return getRoutingComponent([EmailPasswordPreBuiltUI]);
  }

  return (
    <div className="App">
      <PanelGroup
        direction="horizontal"
        key={`panel-group-${isMobile ? "mobile" : "desktop"}`}
      >
        {/* Left Sidebar Panel */}
        {session.loading === false && session.userId && !isMobile ? (
          <>
            <Panel
              id="left-panel"
              ref={leftPanelRef}
              defaultSize={20}
              minSize={16}
              maxSize={35}
              className="side-bar-panel"
              collapsible={true}
              collapsedSize={3}
              onCollapse={() => setLeftPanelCollapsed(true)}
              onExpand={() => setLeftPanelCollapsed(false)}
              order={1}
            >
              {leftPanelCollapsed ? (
                <LeftNavBar
                  leftPanelRef={leftPanelRef}
                  setActiveNotesTab={setActiveNotesTab}
                  activeNotesTab={activeNotesTab}
                  leftPanelCollapsed={leftPanelCollapsed}
                />
              ) : (
                <div className="side-bar-content">
                  <Notes
                    defaultTab={activeNotesTab}
                    onTabClick={() => {
                      leftPanelRef.current?.collapse();
                    }}
                  />
                </div>
              )}
            </Panel>
            <PanelResizeHandle className="resize-handle" />
          </>
        ) : null}

        {/* Main Content Panel */}
        <Panel
          id="main-panel"
          defaultSize={
            session.loading === false && session.userId && !isMobile ? 60 : 100
          }
          minSize={40}
          maxSize={100}
          order={2}
        >
          <div className="main-content">
            <div className="tabs">
              <div className="tab-container">
                {stories.map((story: Story) => (
                  <Tab
                    key={story.id}
                    story={story}
                    activeStoryId={activeStoryId}
                    setActive={setActive}
                  />
                ))}
              </div>
              <div className="add">
                <button
                  className="button"
                  onClick={() => createStory("Untitled")}
                >
                  <PlusIcon />
                </button>
              </div>
            </div>
            <div className="app-container">
              <div className="editor-container">
                {stories.map((story: Story) => (
                  <StoryEditor
                    key={story.id}
                    story={story}
                    isActive={story.id === activeStoryId}
                    viewSettings={viewSettings}
                  />
                ))}
              </div>
            </div>
          </div>
        </Panel>

        {/* Right Placeholder Panel */}
        {session.loading === false && session.userId && !isMobile ? (
          <>
            <PanelResizeHandle className="resize-handle" />
            <Panel
              id="right-panel"
              ref={rightPanelRef}
              defaultSize={20}
              minSize={20}
              maxSize={35}
              className="right-panel"
              collapsible={true}
              collapsedSize={3}
              onCollapse={() => setRightPanelCollapsed(true)}
              onExpand={() => setRightPanelCollapsed(false)}
              order={3}
            >
              {rightPanelCollapsed ? (
                <RightNavBar
                  rightPanelRef={rightPanelRef}
                  setActiveAITab={setActiveAITab}
                  activeAITab={activeAITab}
                  rightPanelCollapsed={rightPanelCollapsed}
                />
              ) : (
                <AIPanel
                  defaultTab={activeAITab}
                  onTabClick={() => {
                    rightPanelRef.current?.collapse();
                  }}
                />
              )}
            </Panel>
          </>
        ) : null}
      </PanelGroup>
    </div>
  );
}

export default App;
