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

  // Vertical Navigation Components
  const LeftNavBar = () => (
    <div className="vertical-nav-bar left">
      <button
        className="nav-button"
        onClick={() => leftPanelRef.current?.expand()}
        title="Open Notes Panel"
      >
        <span className="nav-icon">📝</span>
        <span className="nav-label">Notes</span>
      </button>
    </div>
  );

  const RightNavBar = () => (
    <div className="vertical-nav-bar right">
      <button
        className="nav-button"
        onClick={() => rightPanelRef.current?.expand()}
        title="Open Right Panel"
      >
        <span className="nav-icon">⚙️</span>
        <span className="nav-label">Panel</span>
      </button>
    </div>
  );

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
              minSize={8}
              maxSize={35}
              className="side-bar-panel"
              collapsible={true}
              collapsedSize={4}
              onCollapse={() => setLeftPanelCollapsed(true)}
              onExpand={() => setLeftPanelCollapsed(false)}
              order={1}
            >
              {leftPanelCollapsed ? (
                <LeftNavBar />
              ) : (
                <div className="side-bar-content">
                  <Notes />
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
              minSize={8}
              maxSize={35}
              className="right-panel"
              collapsible={true}
              collapsedSize={4}
              onCollapse={() => setRightPanelCollapsed(true)}
              onExpand={() => setRightPanelCollapsed(false)}
              order={3}
            >
              {rightPanelCollapsed ? (
                <RightNavBar />
              ) : (
                <div className="right-panel-content">
                  <div className="placeholder-content">
                    <h3>Right Panel</h3>
                    <p>
                      This is a placeholder panel that can be used for
                      additional features.
                    </p>
                  </div>
                </div>
              )}
            </Panel>
          </>
        ) : null}
      </PanelGroup>
    </div>
  );
}

export default App;
