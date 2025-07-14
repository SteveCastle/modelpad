import { useEffect } from "react";
import { PlusIcon } from "@heroicons/react/24/solid";
import { useQuery } from "react-query";
import { EmailPasswordPreBuiltUI } from "supertokens-auth-react/recipe/emailpassword/prebuiltui";
import { canHandleRoute, getRoutingComponent } from "supertokens-auth-react/ui";
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

function App() {
  const {
    setActive,
    createStory,
    setAvailableModels,
    setGenerationState,
    stories,
    sideBarOpen,
    setSideBarOpen,
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

  // If activeStory changes cancel generation
  useEffect(() => {
    if (generationState !== "ready") {
      cancelGeneration();
    }
  }, [activeStoryId]);

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
      {session.loading === false && session.userId ? (
        <div
          className={["side-bar", sideBarOpen ? "open" : "closed"].join(" ")}
        >
          {sideBarOpen ? <Notes /> : null}
          <div
            className="toggle-handle"
            onClick={() => {
              setSideBarOpen(!sideBarOpen);
            }}
          ></div>
        </div>
      ) : null}
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
            <button className="button" onClick={() => createStory("Untitled")}>
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
    </div>
  );
}

export default App;
