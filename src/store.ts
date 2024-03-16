import { ulid } from "ulid";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ModelSettings = {
  model: string | null;
  temperature: number;
  stop: string[];
};

export type Story = {
  id: string;
  title: string;
  content: string | undefined;
  context?: number[];
};

type LoadingStates =
  | "ready"
  | "loading"
  | "generating"
  | "error"
  | "no-connection";

type State = {
  host: string;
  modelSettings: ModelSettings;
  stories: Story[];
  activeStoryId: string;
  abortController?: AbortController;
  generationState: LoadingStates;
  availableModels: string[];
  setAvailableModels: (models: string[]) => void;
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

const defaultSettings: ModelSettings = {
  model: null,
  temperature: 1,
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

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      stories: defaultStories,
      host: "http://localhost:11434",
      availableModels: [],
      modelSettings: defaultSettings,
      activeStoryId: defaultStories[0].id,
      abortController: new AbortController(),
      generationState: "no-connection",
      setAvailableModels: (models: string[]) => {
        set(() => ({
          availableModels: models,
          generationState: "ready",
          modelSettings: {
            ...get().modelSettings,
            model: get().modelSettings.model
              ? get().modelSettings.model
              : models[0],
          },
        }));
      },
      changeModel: (model: string) => {
        set(() => ({
          modelSettings: { ...get().modelSettings, model },
        }));
      },
      cycleModel: () => {
        const models = get().availableModels;
        const currentModel = get().modelSettings.model;
        const currentIndex = currentModel ? models.indexOf(currentModel) : 0;
        const nextIndex = (currentIndex + 1) % models.length;
        set(() => ({
          modelSettings: { ...get().modelSettings, model: models[nextIndex] },
        }));
      },
      setGenerationState: (state: LoadingStates) => {
        console.log("setting generation state", state);
        set(() => ({
          generationState: state,
        }));
      },
      cancelGeneration: () => {
        get().abortController?.abort();
        console.log("canceling generation");
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
            { title: title ? title : "Untitled", id: newId, content: "" },
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
        host: state.host,
        modelSettings: state.modelSettings,
      }),
    }
  )
);
