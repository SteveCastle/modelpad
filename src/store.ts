import { ulid } from "ulid";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Story = {
  id: string;
  title: string;
  content: string | undefined;
};

type State = {
  stories: Story[];
  activeStoryId: string;
  abortController?: AbortController;
  generationState: "idle" | "generating" | "error";
  setGenerationState: (state: "idle" | "generating" | "error") => void;
  cancelGeneration: () => void;
  setActive: (id: string) => void;
  updateStory: (id: string, content: string) => void;
  updateTitle: (id: string, title: string) => void;
  closeStory: (id: string) => void;
  createStory: () => void;
};

const defaultStories: Story[] = [
  {
    id: ulid(),
    title: "Untitled",
    content: undefined,
  },
];

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      stories: defaultStories,
      activeStoryId: defaultStories[0].id,
      abortController: new AbortController(),
      generationState: "idle",
      setGenerationState: (state: "idle" | "generating" | "error") => {
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
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        stories: state.stories,
        activeStoryId: state.activeStoryId,
      }),
    }
  )
);
