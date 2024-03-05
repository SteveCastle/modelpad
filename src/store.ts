import { ulid } from "ulid";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ModelSettings = {
  endpoint: string;
  model: string;
  temperature: number;
  stop: string[];
};

export type Story = {
  id: string;
  title: string;
  content: string | undefined;
  context?: number[];
};

type LoadingStates = "idle" | "loading" | "generating" | "error";

type State = {
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
  createStory: () => void;
};

const defaultSettings: ModelSettings = {
  endpoint: "http://localhost:11434/api/generate",
  model: "rose",
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
      availableModels: ["rose", "mixtral"],
      modelSettings: defaultSettings,
      activeStoryId: defaultStories[0].id,
      abortController: new AbortController(),
      generationState: "idle",
      setAvailableModels: (models: string[]) => {
        set(() => ({
          availableModels: models,
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
        const currentIndex = models.indexOf(currentModel);
        const nextIndex = (currentIndex + 1) % models.length;
        set(() => ({
          modelSettings: { ...get().modelSettings, model: models[nextIndex] },
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
          generationState: "idle",
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
      createStory: () => {
        const newId = ulid();
        set(() => ({
          stories: [
            ...get().stories,
            { title: "Untitled", id: newId, content: "" },
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
      }),
    }
  )
);
