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
  tags?: { id: string; path: string[] }[];
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
  tags?: { id: string; path: string[] }[];
};

// Helper function to extract tags from lexical state JSON
export const extractTagsFromLexicalState = (
  bodyJson: string
): { id: string; path: string[] }[] => {
  try {
    const lexicalState = JSON.parse(bodyJson);
    console.log(
      "🏷️ [extractTagsFromLexicalState] Lexical state:",
      lexicalState
    );
    const tags: { id: string; path: string[] }[] = [];

    const extractTagsRecursively = (node: unknown) => {
      if (node && typeof node === "object" && node !== null) {
        const nodeObj = node as Record<string, unknown>;
        if (nodeObj.type === "tag" && nodeObj.tagId && nodeObj.tagPath) {
          tags.push({
            id: nodeObj.tagId as string,
            path: Array.isArray(nodeObj.tagPath)
              ? nodeObj.tagPath
              : [nodeObj.tagPath as string],
          });
        }

        // Recursively check children
        if (nodeObj.children && Array.isArray(nodeObj.children)) {
          nodeObj.children.forEach(extractTagsRecursively);
        }
      }
    };

    // Start recursion from the root node, not the top-level lexical state
    if (lexicalState.root) {
      extractTagsRecursively(lexicalState.root);
    } else {
      // Fallback for different lexical state structures
      extractTagsRecursively(lexicalState);
    }
    console.log("🏷️ [extractTagsFromLexicalState] Extracted tags:", tags);
    return tags;
  } catch (error) {
    console.warn("Failed to extract tags from lexical state:", error);
    return [];
  }
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
  ensureParentCategories: (path: string[]) => void;
  migrateTags: () => void;
  getTagUsageCounts: () => { [tagId: string]: number };
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
    tags: [],
  },
];

const defaultStories: Story[] = [
  {
    id: v4(),
    title: "Untitled",
    content: createEmptyContent(),
    context: undefined,
    open: true,
    tags: [],
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
          name: "characters/protagonist/hero",
          path: ["characters", "protagonist", "hero"],
          createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        },
        {
          id: "sample-2",
          name: "settings/fantasy/medieval-castle",
          path: ["settings", "fantasy", "medieval-castle"],
          createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        },
        {
          id: "sample-3",
          name: "genres/mystery/detective",
          path: ["genres", "mystery", "detective"],
          createdAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
        },
        {
          id: "sample-4",
          name: "style/perspective/first-person",
          path: ["style", "perspective", "first-person"],
          createdAt: new Date(Date.now() - 345600000).toISOString(), // 4 days ago
        },
        {
          id: "sample-5",
          name: "characters/antagonist/dark-lord",
          path: ["characters", "antagonist", "dark-lord"],
          createdAt: new Date(Date.now() - 432000000).toISOString(), // 5 days ago
        },
        {
          id: "sample-6",
          name: "settings/modern/urban-city",
          path: ["settings", "modern", "urban-city"],
          createdAt: new Date(Date.now() - 518400000).toISOString(), // 6 days ago
        },
        {
          id: "sample-7",
          name: "style/tone/dark-atmospheric",
          path: ["style", "tone", "dark-atmospheric"],
          createdAt: new Date(Date.now() - 604800000).toISOString(), // 1 week ago
        },
        {
          id: "sample-8",
          name: "plot/conflict/internal-struggle",
          path: ["plot", "conflict", "internal-struggle"],
          createdAt: new Date(Date.now() - 691200000).toISOString(), // 8 days ago
        },
        {
          id: "sample-9",
          name: "characters/archetype/mentor",
          path: ["characters", "archetype", "mentor"],
          createdAt: new Date(Date.now() - 777600000).toISOString(), // 9 days ago
        },
        {
          id: "sample-10",
          name: "genres/sci-fi/dystopian",
          path: ["genres", "sci-fi", "dystopian"],
          createdAt: new Date(Date.now() - 864000000).toISOString(), // 10 days ago
        },
        {
          id: "sample-11",
          name: "settings/historical/victorian-london",
          path: ["settings", "historical", "victorian-london"],
          createdAt: new Date(Date.now() - 950400000).toISOString(), // 11 days ago
        },
        {
          id: "sample-12",
          name: "style/device/flashback",
          path: ["style", "device", "flashback"],
          createdAt: new Date(Date.now() - 1036800000).toISOString(), // 12 days ago
        },
        {
          id: "sample-13",
          name: "emotion/atmosphere/suspenseful",
          path: ["emotion", "atmosphere", "suspenseful"],
          createdAt: new Date(Date.now() - 1123200000).toISOString(), // 13 days ago
        },
        {
          id: "sample-14",
          name: "plot/theme/redemption",
          path: ["plot", "theme", "redemption"],
          createdAt: new Date(Date.now() - 1209600000).toISOString(), // 14 days ago
        },
        {
          id: "sample-15",
          name: "genres/romance/contemporary",
          path: ["genres", "romance", "contemporary"],
          createdAt: new Date(Date.now() - 1296000000).toISOString(), // 15 days ago
        },
      ],
      setNewTitle: (title: string) => {
        set(() => ({
          newTitle: title,
        }));
      },
      mergeNotes: (notes: Note[], updateActiveStory: boolean) => {
        console.log(
          "📋 [mergeNotes] Called with notes:",
          notes.length,
          "updateActiveStory:",
          updateActiveStory
        );

        set(() => {
          // Extract tags from each note's body and update the note
          const notesWithTags = notes.map((note) => ({
            ...note,
            tags: extractTagsFromLexicalState(note.body),
          }));

          console.log(
            "📋 [mergeNotes] Notes with tags:",
            notesWithTags.map((n) => ({ id: n.id, tags: n.tags }))
          );

          // Iterate over the existing stories and if the note ID exists, update the story
          const openTabs = get().stories.map((s) => {
            const note = notesWithTags.find((n) => n.id === s.id);
            if (note) {
              return {
                ...s,
                title: note.title,
                content: ensureValidContentStructure(JSON.parse(note.body)),
                tags: note.tags,
              };
            }
            return s;
          });
          // Iterate over the notes and if the ID does not exist, create a new story
          const newStories = notesWithTags
            .filter((n) => !get().stories.find((s) => s.id === n.id))
            .map((n) => ({
              id: n.id,
              title: n.title,
              content: ensureValidContentStructure(JSON.parse(n.body)),
              open: true,
              synced: true,
              includeInContext: n.includeInContext || false,
              tags: n.tags,
            }));
          return {
            stories: [...openTabs, ...newStories],
            activeStoryId: updateActiveStory
              ? notes[0].id
              : get().activeStoryId,
          };
        });

        // Tag usage counts are now calculated dynamically via getTagUsageCounts()
        console.log("📋 [mergeNotes] Stories updated with tags");
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
        console.log("📝 [updateStory] Called for story:", id);

        set(() => {
          const contentJson = JSON.stringify(content);
          const extractedTags = extractTagsFromLexicalState(contentJson);

          console.log(
            "📝 [updateStory] Extracted tags for story:",
            extractedTags
          );
          console.log(
            "📝 [updateStory] Before update - current stories count:",
            get().stories.length
          );

          const updatedStories = get().stories.map((s) =>
            s.id === id ? { ...s, content, tags: extractedTags } : s
          );

          console.log(
            "📝 [updateStory] After update - story tags:",
            updatedStories.find((s) => s.id === id)?.tags
          );

          return {
            stories: updatedStories,
          };
        });

        // Tag usage counts are now calculated dynamically via getTagUsageCounts()
        console.log("📝 [updateStory] Story updated with tags");
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
              tags: [],
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
      addTag: (tag: Omit<Tag, "id" | "createdAt">) => {
        const newTag: Tag = {
          ...tag,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
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
      getTagUsageCounts: () => {
        // Get all tags from all current stories
        const allStoryTags = get().stories.flatMap((story) => story.tags || []);

        // Count occurrences of each tag ID
        const counts: { [tagId: string]: number } = {};
        allStoryTags.forEach((storyTag) => {
          counts[storyTag.id] = (counts[storyTag.id] || 0) + 1;
        });

        return counts;
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

        const tagUsageCounts = get().getTagUsageCounts();

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

            // Then by usage count (dynamic)
            const aUsageCount = tagUsageCounts[a.id] || 0;
            const bUsageCount = tagUsageCounts[b.id] || 0;
            if (bUsageCount !== aUsageCount) {
              return bUsageCount - aUsageCount;
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
