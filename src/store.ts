import { v4 } from "uuid";
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
  open?: boolean;
  synced?: boolean;
};

export type Note = {
  id: string;
  title: string;
  body: string;
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
  updateSyncState: (id: string, synced: boolean) => void;
  updateContext: (id: string, context: number[]) => void;
  clearContext: (id: string) => void;
  closeStory: (id: string) => void;
  createStory: (title: string) => void;
  mergeNotes: (notes: Note[]) => void; // Updates stories if ID exists, otherwise creates a new story
};

const ollamaSettings: ModelSettings = {
  mirostat: 2, // Mirostat disabled
  mirostat_eta: 0.1, // Learning rate for feedback response
  mirostat_tau: 5.0, // Balance between coherence and diversity
  temperature: 1.2, // Model temperature for creativity
  top_p: 0.9, // Top p sampling
  top_k: 40, // Top k sampling
  repeat_penalty: 1.0, // Penalty for repeating
  num_predict: -1, // Number of predictions to generate
  stop: ["user:"],
};

const defaultStories: Story[] = [
  {
    id: v4(),
    title: "Untitled",
    content: undefined,
    context: undefined,
    open: true,
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
      serverKey: "modelPadServer",
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
      mergeNotes: (notes: Note[]) => {
        set(() => {
          // Iterate over the existing stories and if the note ID exists, update the story
          const updatedStories = get().stories.map((s) => {
            const note = notes.find((n) => n.id === s.id);
            if (note) {
              return {
                ...s,
                title: note.title,
                content: JSON.parse(note.body),
              };
            }
            return s;
          });
          // Iterate over the notes and if the ID does not exist, create a new story
          const newStories = notes
            .filter((n) => !get().stories.find((s) => s.id === n.id))
            .map((n) => ({
              id: n.id,
              title: n.title,
              content: JSON.parse(n.body),
              open: true,
              synced: true,
            }));
          return {
            stories: [...updatedStories, ...newStories],
          };
        });
      },
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
      updateSyncState: (id: string, synced: boolean) => {
        set(() => ({
          stories: get().stories.map((s) =>
            s.id === id ? { ...s, synced } : s
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
              stories: [...get().stories, ...defaultStories],
              activeStoryId: defaultStories[0].id,
            };
          }
          const activeStoryId =
            get().activeStoryId === id
              ? filteredStories[filteredStories.length - 1].id
              : get().activeStoryId;

          return {
            stories: get().stories.map((s) =>
              s.id === id ? { ...s, open: false } : s
            ),
            activeStoryId,
          };
        });
      },
      createStory: (title: string) => {
        const newId = v4();
        set(() => ({
          stories: [
            ...get().stories,
            {
              title: title ? title : "Untitled",
              id: newId,
              content: "",
              modelSettings: ollamaSettings,
              open: true,
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
