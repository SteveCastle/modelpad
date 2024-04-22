import { ulid } from "ulid";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type PromptTypeKeys = "newScene" | "rewrite" | "summarize";

type PromptTemplates = { [key in PromptTypeKeys]: string };

type ViewSettings = {
  readingMode: boolean;
  zoom: number;
};

type Server = {
  host: string;
  providerKey: string;
  name: string;
};

type AvailableServers = { [key: string]: Server };

export type ModelSettings = {
  mirostat?: 0 | 1 | 2;
  mirostat_eta?: number;
  mirostat_tau?: number;
  num_ctx?: number;
  num_gqa?: number;
  num_gpu?: number;
  num_thread?: number;
  repeat_last_n?: number;
  repeat_penalty?: number;
  temperature?: number;
  seed?: number;
  stop?: string[];
  tfs_z?: number;
  num_predict?: number;
  top_k?: number;
  top_p?: number;
};

export type Story = {
  id: string;
  title: string;
  content?: string;
  context?: number[];
};

type LoadingStates =
  | "ready"
  | "loading"
  | "generating"
  | "error"
  | "no-connection";

type State = {
  serverKey: string;
  viewSettings: ViewSettings;
  model: string | null;
  stories: Story[];
  activeStoryId: string;
  promptTemplateKey: PromptTypeKeys;
  promptTemplates: PromptTemplates;
  abortController?: AbortController;
  generationState: LoadingStates;
  availableModels: string[];
  availableServers: AvailableServers;
  modelSettings: ModelSettings;
  changePromptTemplate: (key: PromptTypeKeys, text: string) => void;
  toggleReadingMode: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setServerKey: (serverKey: string) => void;
  setAvailableModels: (models: string[]) => void;
  updateModelSettings: (settings: ModelSettings) => void;
  changeModel: (model: string) => void;
  cycleModel: () => void;
  setGenerationState: (state: LoadingStates) => void;
  cancelGeneration: () => void;
  setActive: (id: string) => void;
  updateStory: (id: string, content: string) => void;
  updateTitle: (id: string, title: string) => void;
  updateContext: (id: string, context: number[]) => void;
  clearContext: (id: string) => void;
  closeStory: (id: string) => void;
  createStory: (title: string) => void;
};

const ollamaSettings: ModelSettings = {
  mirostat: 2, // Mirostat disabled
  mirostat_eta: 0.1, // Learning rate for feedback response
  mirostat_tau: 5.0, // Balance between coherence and diversity
  temperature: 1.2, // Model temperature for creativity
  top_p: 0.9, // Top p sampling
  top_k: 40, // Top k sampling
  repeat_penalty: 1.0, // Penalty for repeating
  stop: ["user:"],
};

const defaultStories: Story[] = [
  {
    id: ulid(),
    title: "Untitled",
    content: undefined,
    context: undefined,
  },
];

const defaultAvailableServers: AvailableServers = {
  modelPadServer: {
    host: "https://modelpad.app",
    name: "Free Model Pad Server",
    providerKey: "claude",
  },
  localOllama: {
    host: "http://localhost:11434",
    name: "Local Ollama",
    providerKey: "ollama",
  },
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      stories: defaultStories,
      viewSettings: {
        readingMode: true,
        zoom: 1.0,
      },
      serverKey: "localOllama",
      availableModels: [],
      availableServers: defaultAvailableServers,
      model: null,
      modelSettings: ollamaSettings,
      promptTemplateKey: "newScene",
      promptTemplates: {
        newScene: `<text>
      `,
        rewrite: `A Rewording of this text:
<text>
ALTERNATE VERSION:
        `,
        summarize: `A summary of the following text:
<text>

BEGIN SUMMARY:
        `,
      },
      activeStoryId: defaultStories[0].id,
      abortController: new AbortController(),
      generationState: "no-connection",
      toggleReadingMode: () => {
        set((state) => ({
          viewSettings: {
            ...state.viewSettings,
            readingMode: !state.viewSettings.readingMode,
          },
        }));
      },
      zoomIn: () => {
        set((state) => ({
          viewSettings: {
            ...state.viewSettings,
            zoom: state.viewSettings.zoom + 0.1,
          },
        }));
      },
      zoomOut: () => {
        set((state) => ({
          viewSettings: {
            ...state.viewSettings,
            zoom: state.viewSettings.zoom - 0.1,
          },
        }));
      },
      resetZoom: () => {
        set((state) => ({
          viewSettings: {
            ...state.viewSettings,
            zoom: 1.0,
          },
        }));
      },
      changePromptTemplate: (key: PromptTypeKeys, text: string) => {
        set(() => ({
          promptTemplates: {
            ...get().promptTemplates,
            [key]: text,
          },
        }));
      },
      setServerKey: (serverKey: string) => {
        set(() => ({
          serverKey,
          generationState: "no-connection",
          availableModels: [],
          model: null,
        }));
      },
      setAvailableModels: (models: string[]) => {
        set(() => ({
          availableModels: models,
          generationState:
            get().generationState === "no-connection"
              ? "ready"
              : get().generationState,
          model: get().model ? get().model : models[0],
        }));
      },
      updateModelSettings: (settings: ModelSettings) => {
        //Merge the input settings with the current settings
        set(() => ({
          modelSettings: { ...get().modelSettings, ...settings },
        }));
      },
      changeModel: (model: string) => {
        set(() => ({
          model,
        }));
      },
      cycleModel: () => {
        const models = get().availableModels;
        const currentModel = get().model;
        const currentIndex = currentModel ? models.indexOf(currentModel) : 0;
        const nextIndex = (currentIndex + 1) % models.length;
        set(() => ({
          model: models[nextIndex],
        }));
      },
      setGenerationState: (state: LoadingStates) => {
        set(() => ({
          generationState: state,
        }));
      },
      cancelGeneration: () => {
        get().abortController?.abort();
        set(() => ({
          abortController: new AbortController(),
          generationState: "ready",
        }));
      },
      setActive: (id: string) => {
        set(() => ({
          activeStoryId: id,
        }));
      },
      updateStory: (id: string, content: string) => {
        set(() => ({
          stories: get().stories.map((s) =>
            s.id === id ? { ...s, content } : s
          ),
        }));
      },
      updateTitle: (id: string, title: string) => {
        set(() => ({
          stories: get().stories.map((s) =>
            s.id === id ? { ...s, title } : s
          ),
        }));
      },
      updateContext: (id: string, context: number[]) => {
        set(() => ({
          stories: get().stories.map((s) =>
            s.id === id ? { ...s, context } : s
          ),
        }));
      },
      clearContext: (id: string) => {
        set(() => ({
          stories: get().stories.map((s) =>
            s.id === id ? { ...s, context: undefined } : s
          ),
        }));
      },
      closeStory: (id: string) => {
        set(() => {
          const filteredStories = get().stories.filter((s) => s.id !== id);
          if (filteredStories.length === 0) {
            return {
              stories: defaultStories,
              activeStoryId: defaultStories[0].id,
            };
          }
          const activeStoryId =
            get().activeStoryId === id
              ? filteredStories[filteredStories.length - 1].id
              : get().activeStoryId;

          return {
            stories: filteredStories,
            activeStoryId,
          };
        });
      },
      createStory: (title: string) => {
        const newId = ulid();
        set(() => ({
          stories: [
            ...get().stories,
            {
              title: title ? title : "Untitled",
              id: newId,
              content: "",
              modelSettings: ollamaSettings,
            },
          ],
          activeStoryId: newId,
        }));
      },
    }),
    {
      name: "editor",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        stories: state.stories,
        activeStoryId: state.activeStoryId,
        viewSettings: state.viewSettings,
        serverKey: state.serverKey,
        model: state.model,
        modelSettings: state.modelSettings,
      }),
    }
  )
);
