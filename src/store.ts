import { ulid } from "ulid";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type ModelSettings = {
  mirostat: 0 | 1 | 2;
  mirostat_eta: number;
  mirostat_tau: number;
  num_ctx: number;
  num_gqa: number;
  num_gpu: number;
  num_thread: number;
  repeat_last_n: number;
  repeat_penalty: number;
  temperature: number;
  seed: number;
  stop: string[];
  tfs_z: number;
  num_predict: number;
  top_k: number;
  top_p: number;
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
  model: string | null;
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
  mirostat: 0, // Mirostat disabled
  mirostat_eta: 0.1, // Learning rate for feedback response
  mirostat_tau: 5.0, // Balance between coherence and diversity
  num_ctx: 4096, // Context window size (given as default 2048, but seems like a typo based on context)
  num_gqa: 1, // Number of GQA groups in the transformer layer
  num_gpu: 50, // Number of layers to send to GPU(s)
  num_thread: 8, // Number of threads for computation
  repeat_last_n: 64, // How far back to look to prevent repetition
  repeat_penalty: 1.1, // Penalty strength for repetitions
  temperature: 1.2, // Model temperature for creativity
  seed: 0, // Random number seed for generation consistency
  stop: ["User:"], // Stop sequence for generation
  tfs_z: 1, // Tail free sampling setting
  num_predict: -1, // Maximum number of tokens to predict
  top_k: 40, // Reduces probability of generating nonsense
  top_p: 0.9, // Works with top-k for text diversity
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
      model: null,
      modelSettings: defaultSettings,
      activeStoryId: defaultStories[0].id,
      abortController: new AbortController(),
      generationState: "no-connection",
      setAvailableModels: (models: string[]) => {
        set(() => ({
          availableModels: models,
          generationState: "ready",
          model: get().model ? get().model : models[0],
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
        model: state.model,
        modelSettings: state.modelSettings,
      }),
    }
  )
);
