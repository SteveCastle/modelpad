import { v4 } from "uuid";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Content, welcomeContent } from "./welcomeContent";

// Helper function to create empty content with a default paragraph
const createEmptyContent = (): Content => ({
  root: {
    children: [
      {
        children: [],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "paragraph",
        version: 1,
      },
    ],
    direction: "ltr",
    format: "",
    indent: 0,
    type: "root",
    version: 1,
  },
});

// Helper function to ensure content has valid structure
const ensureValidContentStructure = (
  content: Content | undefined | null
): Content => {
  if (!content || !content.root || !content.root.children) {
    return createEmptyContent();
  }
  return content;
};

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
  content?: Content;
  context?: number[];
  open?: boolean;
  synced?: boolean;
  includeInContext?: boolean;
};

export type Note = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at?: string;
  parent?: string | null;
  includeInContext?: boolean;
  is_shared?: boolean;
};

export type PromptGeneration = {
  promptId: string;
  storyId: string;
  promptNodeKey: string;
  generatedNodeKeys: string[];
  originalContent: string;
  status: "pending" | "generating" | "completed" | "cancelled";
  canUndo: boolean;
  canRedo: boolean;
};

export type Tag = {
  id: string;
  name: string; // The full display name (e.g., "project/frontend/components")
  path: string[]; // The hierarchical path (e.g., ["project", "frontend", "components"])
  color?: string;
  usageCount: number;
  createdAt: string;
  lastUsedAt?: string;
  isCategory?: boolean; // True if this is a category container (has children)
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
  systemPromptTemplates: PromptTemplates;
  ragPromptTemplates: PromptTemplates;
  promptTemplates: PromptTemplates;
  abortController?: AbortController;
  generationState: LoadingStates;
  availableModels: string[];
  availableServers: AvailableServers;
  modelSettings: ModelSettings;
  sideBarOpen: boolean;
  useRag: boolean;
  newTitle: string;
  promptGenerations: PromptGeneration[];
  tags: Tag[];
  setNewTitle: (title: string) => void;
  setUseRag: (useRag: boolean) => void;
  setSideBarOpen: (open: boolean) => void;
  setServerHost: (host: string) => void;
  setServerName: (title: string) => void;
  changePromptTemplate: (key: PromptTypeKeys, text: string) => void;
  changeSystemPromptTemplate: (key: PromptTypeKeys, text: string) => void;
  changeRagPromptTemplate: (key: PromptTypeKeys, text: string) => void;
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
  setIncludeInContext: (id: string, include: boolean) => void;
  updateStory: (id: string, content: Content) => void;
  updateTitle: (id: string, title: string) => void;
  updateSyncState: (id: string, synced: boolean) => void;
  updateContext: (id: string, context: number[]) => void;
  clearContext: (id: string) => void;
  closeStory: (id: string) => void;
  closeAllStories: () => void;
  closeOtherStories: (id: string) => void;
  closeToTheRight: (id: string) => void;
  createStory: (title: string) => void;
  mergeNotes: (notes: Note[], updateActiveStory: boolean) => void;
  // Prompt generation actions
  addPromptGeneration: (generation: PromptGeneration) => void;
  updatePromptGeneration: (
    promptId: string,
    updates: Partial<PromptGeneration>
  ) => void;
  removePromptGeneration: (promptId: string) => void;
  getPromptGeneration: (promptId: string) => PromptGeneration | undefined;
  // Tag management actions
  addTag: (tag: Omit<Tag, "id" | "createdAt" | "usageCount">) => Tag;
  addHierarchicalTag: (pathString: string) => Tag;
  updateTag: (tagId: string, updates: Partial<Tag>) => void;
  deleteTag: (tagId: string) => void;
  getTag: (tagId: string) => Tag | undefined;
  searchTags: (query: string) => Tag[];
  searchTagsByPath: (pathQuery: string) => Tag[];
  getTagsByParentPath: (parentPath: string[]) => Tag[];
  getChildTags: (parentTag: Tag) => Tag[];
  incrementTagUsage: (tagId: string) => void;
  ensureParentCategories: (path: string[]) => void;
  migrateTags: () => void;
};

const ollamaSettings: ModelSettings = {
  mirostat: 2, // Mirostat disabled
  mirostat_eta: 0.1, // Learning rate for feedback response
  mirostat_tau: 5.0, // Balance between coherence and diversity
  temperature: 1.0, // Model temperature for creativity
  top_p: 0.9, // Top p sampling
  top_k: 40, // Top k sampling
  repeat_penalty: 1.0, // Penalty for repeating
  num_predict: 4096, // Number of predictions to generate
  stop: ["user:"],
};

const initialStories: Story[] = [
  {
    id: v4(),
    title: "Welcome to ModelPad",
    content: welcomeContent,
    context: undefined,
    open: true,
  },
];

const defaultStories: Story[] = [
  {
    id: v4(),
    title: "Untitled",
    content: createEmptyContent(),
    context: undefined,
    open: true,
  },
];

const defaultAvailableServers: AvailableServers = {
  modelPadServer: {
    host: import.meta.env.VITE_BACKEND_HOST || "https://modelpad.app",
    name: "Cloud",
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
      stories: initialStories,
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
        newScene: `<text>`,
        rewrite: `<text>`,
        summarize: `<text>`,
      },
      systemPromptTemplates: {
        newScene:
          "You are a researcher researching a topic and helping me collect information, and understand a topic.",
        rewrite:
          "You are a writer rewriting a scene. Rewrite the scene in a different style or from a different perspective.",
        summarize:
          "You are a writer summarizing a scene. Summarize the scene in a few sentences.",
      },
      ragPromptTemplates: {
        newScene:
          "Below is a list of documents that you can use to help you write a new scene. You can use these documents to help you generate ideas for your scene.\n<docs>\nEND OF DOCS",
        rewrite:
          "Below is a list of documents that you can use to help you rewrite a scene. You can use these documents to help you generate ideas for your scene.\n<docs>\nEND OF DOCS",
        summarize:
          "Below is a list of documents that you can use to help you summarize a scene. You can use these documents to help you generate ideas for your scene.\n<docs>\nEND OF DOCS",
      },
      activeStoryId: initialStories[0].id,
      abortController: new AbortController(),
      generationState: "no-connection",
      sideBarOpen: false,
      useRag: false,
      newTitle: "",
      promptGenerations: [],
      tags: [
        {
          id: "sample-1",
          name: "project/research/ai",
          path: ["project", "research", "ai"],
          usageCount: 12,
          createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          lastUsedAt: new Date().toISOString(),
        },
        {
          id: "sample-2",
          name: "project/frontend/components",
          path: ["project", "frontend", "components"],
          usageCount: 8,
          createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          lastUsedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        },
        {
          id: "sample-3",
          name: "project/backend/api",
          path: ["project", "backend", "api"],
          usageCount: 5,
          createdAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
          lastUsedAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        },
        {
          id: "sample-4",
          name: "people/team/developers",
          path: ["people", "team", "developers"],
          usageCount: 6,
          createdAt: new Date(Date.now() - 345600000).toISOString(), // 4 days ago
          lastUsedAt: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
        },
        {
          id: "sample-5",
          name: "people/clients/john-doe",
          path: ["people", "clients", "john-doe"],
          usageCount: 3,
          createdAt: new Date(Date.now() - 432000000).toISOString(), // 5 days ago
          lastUsedAt: new Date(Date.now() - 21600000).toISOString(), // 6 hours ago
        },
        {
          id: "sample-6",
          name: "locations/office/meeting-rooms",
          path: ["locations", "office", "meeting-rooms"],
          usageCount: 4,
          createdAt: new Date(Date.now() - 518400000).toISOString(), // 6 days ago
          lastUsedAt: new Date(Date.now() - 10800000).toISOString(), // 3 hours ago
        },
        {
          id: "sample-7",
          name: "tools/design/figma",
          path: ["tools", "design", "figma"],
          usageCount: 7,
          createdAt: new Date(Date.now() - 604800000).toISOString(), // 1 week ago
          lastUsedAt: new Date(Date.now() - 43200000).toISOString(), // 12 hours ago
        },
        {
          id: "sample-8",
          name: "meetings/weekly/standup",
          path: ["meetings", "weekly", "standup"],
          usageCount: 15,
          createdAt: new Date(Date.now() - 691200000).toISOString(), // 8 days ago
          lastUsedAt: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
        },
      ],
      setNewTitle: (title: string) => {
        set(() => ({
          newTitle: title,
        }));
      },
      mergeNotes: (notes: Note[], updateActiveStory: boolean) => {
        set(() => {
          // Iterate over the existing stories and if the note ID exists, update the story
          const openTabs = get().stories.map((s) => {
            const note = notes.find((n) => n.id === s.id);
            if (note) {
              return {
                ...s,
                title: note.title,
                content: ensureValidContentStructure(JSON.parse(note.body)),
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
              content: ensureValidContentStructure(JSON.parse(n.body)),
              open: true,
              synced: true,
              includeInContext: n.includeInContext || false,
            }));
          return {
            stories: [...openTabs, ...newStories],
            activeStoryId: updateActiveStory
              ? notes[0].id
              : get().activeStoryId,
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
      changeSystemPromptTemplate: (key: PromptTypeKeys, text: string) => {
        set(() => ({
          systemPromptTemplates: {
            ...get().systemPromptTemplates,
            [key]: text,
          },
        }));
      },
      changeRagPromptTemplate: (key: PromptTypeKeys, text: string) => {
        set(() => ({
          ragPromptTemplates: {
            ...get().ragPromptTemplates,
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
      updateStory: (id: string, content: Content) => {
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
              stories: [...defaultStories],
              activeStoryId: defaultStories[0].id,
            };
          }
          const activeStoryId =
            get().activeStoryId === id
              ? filteredStories[filteredStories.length - 1].id
              : get().activeStoryId;

          return {
            stories: get().stories.filter((s) => s.id !== id),
            activeStoryId,
          };
        });
      },
      closeAllStories: () => {
        set(() => ({
          stories: defaultStories,
          activeStoryId: defaultStories[0].id,
        }));
      },
      closeOtherStories: (id: string) => {
        set(() => ({
          stories: get().stories.filter((s) => s.id === id),
          activeStoryId: id,
        }));
      },
      closeToTheRight: (id: string) => {
        set(() => {
          const activeStoryIndex = get().stories.findIndex((s) => s.id === id);
          return {
            stories: get().stories.slice(0, activeStoryIndex + 1),
            activeStoryId: id,
          };
        });
      },
      setIncludeInContext: (id: string, include: boolean) => {
        set(() => ({
          stories: get().stories.map((s) =>
            s.id === id ? { ...s, includeInContext: include } : s
          ),
        }));
      },
      createStory: (title: string) => {
        const newId = v4();
        set(() => ({
          stories: [
            ...get().stories,
            {
              title: title ? title : "Untitled",
              id: newId,
              content: createEmptyContent(),
              modelSettings: ollamaSettings,
              open: true,
            },
          ],
          activeStoryId: newId,
        }));
      },
      // Prompt generation actions
      addPromptGeneration: (generation: PromptGeneration) => {
        set(() => ({
          promptGenerations: [...get().promptGenerations, generation],
        }));
      },
      updatePromptGeneration: (
        promptId: string,
        updates: Partial<PromptGeneration>
      ) => {
        set(() => ({
          promptGenerations: get().promptGenerations.map((g) =>
            g.promptId === promptId ? { ...g, ...updates } : g
          ),
        }));
      },
      removePromptGeneration: (promptId: string) => {
        set(() => ({
          promptGenerations: get().promptGenerations.filter(
            (g) => g.promptId !== promptId
          ),
        }));
      },
      getPromptGeneration: (promptId: string) => {
        return get().promptGenerations.find((g) => g.promptId === promptId);
      },
      setServerName: (title: string) => {
        set(() => ({
          availableServers: {
            ...get().availableServers,
            localOllama: {
              ...get().availableServers.localOllama,
              name: title,
            },
          },
        }));
      },
      setServerHost: (host: string) => {
        set(() => ({
          availableServers: {
            ...get().availableServers,
            localOllama: {
              ...get().availableServers.localOllama,
              host,
            },
          },
        }));
      },
      setSideBarOpen: (open: boolean) => {
        set(() => ({
          sideBarOpen: open,
        }));
      },
      setUseRag: (useRag: boolean) => {
        set(() => ({
          useRag,
        }));
      },
      // Tag management actions
      addTag: (tag: Omit<Tag, "id" | "createdAt" | "usageCount">) => {
        const newTag: Tag = {
          ...tag,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          usageCount: 0,
        };
        set(() => ({
          tags: [...get().tags, newTag],
        }));
        return newTag;
      },
      updateTag: (tagId: string, updates: Partial<Tag>) => {
        set(() => ({
          tags: get().tags.map((tag) =>
            tag.id === tagId ? { ...tag, ...updates } : tag
          ),
        }));
      },
      deleteTag: (tagId: string) => {
        set(() => ({
          tags: get().tags.filter((tag) => tag.id !== tagId),
        }));
      },
      getTag: (tagId: string) => {
        return get().tags.find((tag) => tag.id === tagId);
      },
      searchTags: (query: string) => {
        // Use the new hierarchical search
        return get().searchTagsByPath(query);
      },
      migrateTags: () => {
        const tags = get().tags;
        const migratedTags = tags.map((tag) => {
          if (!tag.path || !Array.isArray(tag.path)) {
            // Convert old format tags to new hierarchical format
            const path = tag.name.split("/").filter((p) => p.trim());
            return {
              ...tag,
              path: path.length > 0 ? path : [tag.name],
            };
          }
          return tag;
        });

        // Update if we had to migrate any tags
        if (migratedTags.some((tag, index) => !tags[index].path)) {
          set(() => ({ tags: migratedTags }));
        }
      },
      incrementTagUsage: (tagId: string) => {
        set(() => ({
          tags: get().tags.map((tag) =>
            tag.id === tagId
              ? {
                  ...tag,
                  usageCount: tag.usageCount + 1,
                  lastUsedAt: new Date().toISOString(),
                }
              : tag
          ),
        }));
      },
      addHierarchicalTag: (pathString: string) => {
        const path = pathString.split("/").filter((p) => p.trim());
        const fullPath = path.join("/");

        // Check if tag already exists
        const existingTag = get().tags.find((tag) => tag.name === fullPath);
        if (existingTag) {
          return existingTag;
        }

        // Ensure parent categories exist
        get().ensureParentCategories(path);

        // Create the new tag
        const newTag: Tag = {
          id: crypto.randomUUID(),
          name: fullPath,
          path: path,
          createdAt: new Date().toISOString(),
          usageCount: 0,
        };

        set(() => ({
          tags: [...get().tags, newTag],
        }));

        return newTag;
      },
      ensureParentCategories: (path: string[]) => {
        const currentTags = get().tags;
        const newCategories: Tag[] = [];

        // Create parent categories if they don't exist
        for (let i = 1; i < path.length; i++) {
          const parentPath = path.slice(0, i);
          const parentName = parentPath.join("/");

          const existingParent = currentTags.find(
            (tag) => tag.name === parentName
          );
          if (
            !existingParent &&
            !newCategories.find((tag) => tag.name === parentName)
          ) {
            newCategories.push({
              id: crypto.randomUUID(),
              name: parentName,
              path: parentPath,
              createdAt: new Date().toISOString(),
              usageCount: 0,
              isCategory: true,
            });
          }
        }

        if (newCategories.length > 0) {
          set(() => ({
            tags: [...get().tags, ...newCategories],
          }));
        }
      },
      searchTagsByPath: (pathQuery: string) => {
        const normalizedQuery = pathQuery.toLowerCase().trim();
        if (!normalizedQuery) return get().tags;

        return get()
          .tags.filter((tag) => {
            // Match against full path or any path segment
            return (
              tag.name.toLowerCase().includes(normalizedQuery) ||
              tag.path.some((segment) =>
                segment.toLowerCase().includes(normalizedQuery)
              )
            );
          })
          .sort((a, b) => {
            // Priority: exact match > starts with > contains
            const aExact = a.name.toLowerCase() === normalizedQuery;
            const bExact = b.name.toLowerCase() === normalizedQuery;
            if (aExact && !bExact) return -1;
            if (bExact && !aExact) return 1;

            const aStartsWith = a.name
              .toLowerCase()
              .startsWith(normalizedQuery);
            const bStartsWith = b.name
              .toLowerCase()
              .startsWith(normalizedQuery);
            if (aStartsWith && !bStartsWith) return -1;
            if (bStartsWith && !aStartsWith) return 1;

            // Then by usage count
            if (b.usageCount !== a.usageCount) {
              return b.usageCount - a.usageCount;
            }

            return a.name.localeCompare(b.name);
          });
      },
      getTagsByParentPath: (parentPath: string[]) => {
        const parentPathStr = parentPath.join("/");
        return get().tags.filter((tag) => {
          if (tag.path.length === parentPath.length + 1) {
            return tag.path.slice(0, -1).join("/") === parentPathStr;
          }
          return false;
        });
      },
      getChildTags: (parentTag: Tag) => {
        return get().getTagsByParentPath(parentTag.path);
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
        availableServers: state.availableServers,
        sideBarOpen: state.sideBarOpen,
        promptTemplates: state.promptTemplates,
        systemPromptTemplates: state.systemPromptTemplates,
        ragPromptTemplates: state.ragPromptTemplates,
        tags: state.tags,
      }),
    }
  )
);
