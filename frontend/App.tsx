import { useEffect, useRef, useState } from "react";
import { PlusIcon } from "@heroicons/react/24/solid";
import { useQuery } from "@tanstack/react-query";
import {
  PanelGroup,
  Panel,
  PanelResizeHandle,
  ImperativePanelHandle,
} from "react-resizable-panels";
import { useStore, Story } from "./store";
import { useShallow } from "zustand/react/shallow";
import { StoryEditor } from "./components/StoryEditor";
import { Tab } from "./components/Tab";
import { providers } from "./providers";
import "./App.css";
import { useAuth } from "./hooks/useAuth";
import Notes from "./components/Notes";
import AIPanel from "./components/AIPanel";
import Auth from "./components/Auth";

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
  leftPanelCollapsed: boolean;
}

interface RightNavBarProps {
  rightPanelRef: React.RefObject<ImperativePanelHandle>;
  setActiveAITab: (tab: "model-settings" | "context-control" | "agent") => void;
  activeAITab: "model-settings" | "context-control" | "agent";
  rightPanelCollapsed: boolean;
}

// Vertical Navigation Components (defined outside App to prevent re-creation)
const LeftNavBar = ({ leftPanelRef, leftPanelCollapsed }: LeftNavBarProps) => {
  const { activeNotesTab, setActiveNotesTab } = useStore(
    useShallow((state) => ({
      activeNotesTab: state.activeNotesTab,
      setActiveNotesTab: state.setActiveNotesTab,
    }))
  );

  return (
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
};

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
  const { user, isLoading: authLoading } = useAuth();
  const { providerKey, host } = useStore(
    useShallow((state) => state.availableServers[state.serverKey])
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

  // Check initial panel state from persistence
  useEffect(() => {
    const checkPanelStates = () => {
      const leftPanel = leftPanelRef.current;
      const rightPanel = rightPanelRef.current;

      if (leftPanel) {
        setLeftPanelCollapsed(leftPanel.isCollapsed());
      }
      if (rightPanel) {
        setRightPanelCollapsed(rightPanel.isCollapsed());
      }
    };

    // Check states after a short delay to ensure panels are mounted
    const timer = setTimeout(checkPanelStates, 100);
    return () => clearTimeout(timer);
  }, [isMobile]);

  // If activeStory changes cancel generation
  useEffect(() => {
    if (generationState !== "ready") {
      cancelGeneration();
    }
  }, [activeStoryId]);

  // Note: Panel states are now persisted by react-resizable-panels

  // Migrate existing tags to new hierarchical format on app startup
  useEffect(() => {
    migrateTags();
  }, [migrateTags]);

  interface ResponseData {
    models: Model[];
  }

  const { data, error, isError } = useQuery<ResponseData>({
    queryKey: ["models", host],
    queryFn: provider.getModels(host),
  });

  // Handle query success/error with effects
  useEffect(() => {
    if (isError) {
      setGenerationState("no-connection");
      setAvailableModels([]);
    }
  }, [isError, error, setGenerationState, setAvailableModels]);

  useEffect(() => {
    if (data) {
      const modelNames = data.models.map((model: Model) => model.name);
      setAvailableModels(modelNames);
    }
  }, [data, setAvailableModels]);

  // Show auth screen if not authenticated
  if (authLoading) {
    return <div className="App">Loading...</div>;
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="App">
      <PanelGroup
        direction="horizontal"
        autoSaveId={`modelpad-layout-${user?.id || "anonymous"}`}
      >
        {/* Left Sidebar Panel */}
        {!isMobile ? (
          <>
            <Panel
              id="left-sidebar"
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
                  leftPanelCollapsed={leftPanelCollapsed}
                />
              ) : (
                <div className="side-bar-content">
                  <Notes
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
          id="main-content"
          defaultSize={!isMobile ? 60 : 100}
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
        {!isMobile ? (
          <>
            <PanelResizeHandle className="resize-handle" />
            <Panel
              id="right-sidebar"
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
