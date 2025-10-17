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

export type PromptTemplate = {
  id: string;
  name: string;
  emoji?: string;
  systemPrompt: string;
  mainPrompt: string;
  createdAt: string;
  lastUsedAt?: string;
  // Preferred insertion behavior for streamed output when using this template
  insertionStrategy?: {
    kind:
      | "replace-node"
      | "insert-after-node"
      | "insert-before-node"
      | "append-inside-node"
      | "insert-at-cursor"
      | "replace-selection"
      | "insert-after-selection"
      | "insert-before-selection"
      | "append-to-document-end";
    // Applies to insert-before/after-node and insert-before/after-selection
    newParagraph?: boolean;
  };
};

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

type NotesTabType = "notes" | "vocabulary";

type State = {
  serverKey: string;
  viewSettings: ViewSettings;
  model: string | null;
  stories: Story[];
  activeStoryId: string;
  activePromptTemplateId: string;
  lastUsedPromptTemplateId: string | null;
  promptTemplates: PromptTemplate[];
  editorsNote: string;
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
  // Persistent UI state
  activeNotesTab: NotesTabType;
  collapsedNoteIds: Set<string>;
  collapsedTagIds: Set<string>;
  setActiveNotesTab: (tab: NotesTabType) => void;
  setCollapsedNoteIds: (noteIds: Set<string>) => void;
  setCollapsedTagIds: (tagIds: Set<string>) => void;
  toggleNoteCollapsed: (noteId: string) => void;
  toggleTagCollapsed: (tagId: string) => void;
  setNewTitle: (title: string) => void;
  setUseRag: (useRag: boolean) => void;
  setSideBarOpen: (open: boolean) => void;
  setServerHost: (host: string) => void;
  setServerName: (title: string) => void;
  addPromptTemplate: (
    template: Omit<PromptTemplate, "id" | "createdAt">
  ) => PromptTemplate;
  updatePromptTemplate: (id: string, updates: Partial<PromptTemplate>) => void;
  deletePromptTemplate: (id: string) => void;
  setActivePromptTemplate: (id: string) => void;
  setLastUsedPromptTemplate: (id: string) => void;
  getPromptTemplate: (id: string) => PromptTemplate | undefined;
  setEditorsNote: (note: string) => void;
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
  addTag: (tag: Omit<Tag, "id" | "createdAt">) => Tag;
  addHierarchicalTag: (pathString: string) => Tag;
  updateTag: (tagId: string, updates: Partial<Tag>) => void;
  updateTagLastUsed: (tagId: string) => void;
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

const defaultPromptTemplates: PromptTemplate[] = [
  {
    id: "newScene",
    name: "New Scene",
    emoji: "⚡",
    systemPrompt:
      "You are a researcher researching a topic and helping me collect information, and understand a topic.",
    mainPrompt: "<text>",
    createdAt: new Date().toISOString(),
    insertionStrategy: { kind: "insert-after-node", newParagraph: true },
  },
  {
    id: "rewrite",
    name: "Rewrite",
    emoji: "✏️",
    systemPrompt:
      "You are a writer rewriting a scene. Rewrite the scene in a different style or from a different perspective.",
    mainPrompt: "<text>",
    createdAt: new Date().toISOString(),
    insertionStrategy: { kind: "replace-node" },
  },
  {
    id: "summarize",
    name: "Summarize",
    emoji: "📝",
    systemPrompt:
      "You are a writer summarizing a scene. Summarize the scene in a few sentences.",
    mainPrompt: "<text>",
    createdAt: new Date().toISOString(),
    insertionStrategy: { kind: "insert-after-node", newParagraph: true },
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
      activePromptTemplateId: "newScene",
      lastUsedPromptTemplateId: "newScene",
      promptTemplates: defaultPromptTemplates,
      editorsNote: "",
      activeStoryId: initialStories[0].id,
      abortController: new AbortController(),
      generationState: "no-connection",
      sideBarOpen: false,
      useRag: false,
      newTitle: "",
      promptGenerations: [],
      tags: [],
      activeNotesTab: "notes",
      collapsedNoteIds: new Set(),
      collapsedTagIds: new Set(),
      setActiveNotesTab: (tab: NotesTabType) => {
        set(() => ({
          activeNotesTab: tab,
        }));
      },
      setCollapsedNoteIds: (noteIds: Set<string>) => {
        set(() => ({
          collapsedNoteIds: noteIds,
        }));
      },
      setCollapsedTagIds: (tagIds: Set<string>) => {
        set(() => ({
          collapsedTagIds: tagIds,
        }));
      },
      toggleNoteCollapsed: (noteId: string) => {
        set((state) => {
          const newCollapsedIds = new Set(state.collapsedNoteIds);
          if (newCollapsedIds.has(noteId)) {
            newCollapsedIds.delete(noteId);
          } else {
            newCollapsedIds.add(noteId);
          }
          return {
            collapsedNoteIds: newCollapsedIds,
          };
        });
      },
      toggleTagCollapsed: (tagId: string) => {
        set((state) => {
          const newCollapsedIds = new Set(state.collapsedTagIds);
          if (newCollapsedIds.has(tagId)) {
            newCollapsedIds.delete(tagId);
          } else {
            newCollapsedIds.add(tagId);
          }
          return {
            collapsedTagIds: newCollapsedIds,
          };
        });
      },
      setNewTitle: (title: string) => {
        set(() => ({
          newTitle: title,
        }));
      },
      mergeNotes: (notes: Note[], updateActiveStory: boolean) => {
        set(() => {
          // Extract tags from each note's body and update the note
          const notesWithTags = notes.map((note) => ({
            ...note,
            tags: extractTagsFromLexicalState(note.body),
          }));

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
      addPromptTemplate: (
        template: Omit<PromptTemplate, "id" | "createdAt">
      ) => {
        const newTemplate: PromptTemplate = {
          ...template,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
          emoji: template.emoji || "✨",
          insertionStrategy:
            template.insertionStrategy ||
            ({ kind: "insert-after-node", newParagraph: true } as const),
        };
        set(() => ({
          promptTemplates: [...get().promptTemplates, newTemplate],
        }));
        return newTemplate;
      },
      updatePromptTemplate: (id: string, updates: Partial<PromptTemplate>) => {
        set(() => ({
          promptTemplates: get().promptTemplates.map((template) =>
            template.id === id ? { ...template, ...updates } : template
          ),
        }));
      },
      deletePromptTemplate: (id: string) => {
        const templates = get().promptTemplates;
        if (templates.length <= 1) return; // Don't allow deleting the last template

        set(() => {
          const newTemplates = templates.filter(
            (template) => template.id !== id
          );
          const activeId = get().activePromptTemplateId;
          const lastUsedId = get().lastUsedPromptTemplateId;
          const fallbackId = newTemplates[0]?.id || null;
          return {
            promptTemplates: newTemplates,
            activePromptTemplateId:
              activeId === id ? newTemplates[0].id : activeId,
            lastUsedPromptTemplateId:
              lastUsedId === id ? fallbackId : lastUsedId,
          };
        });
      },
      setActivePromptTemplate: (id: string) => {
        const template = get().promptTemplates.find((t) => t.id === id);
        if (template) {
          set(() => ({
            activePromptTemplateId: id,
          }));
          // Update last used time
          get().updatePromptTemplate(id, {
            lastUsedAt: new Date().toISOString(),
          });
        }
      },
      setLastUsedPromptTemplate: (id: string) => {
        const template = get().promptTemplates.find((t) => t.id === id);
        if (template) {
          set(() => ({ lastUsedPromptTemplateId: id }));
          get().updatePromptTemplate(id, {
            lastUsedAt: new Date().toISOString(),
          });
        }
      },
      setEditorsNote: (note: string) => {
        set(() => ({ editorsNote: note }));
      },
      getPromptTemplate: (id: string) => {
        return get().promptTemplates.find((template) => template.id === id);
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
        set(() => {
          const contentJson = JSON.stringify(content);
          const extractedTags = extractTagsFromLexicalState(contentJson);

          const updatedStories = get().stories.map((s) =>
            s.id === id ? { ...s, content, tags: extractedTags } : s
          );

          return {
            stories: updatedStories,
          };
        });

        // Tag usage counts are now calculated dynamically via getTagUsageCounts()
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
          lastUsedAt: new Date().toISOString(),
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
      updateTagLastUsed: (tagId: string) => {
        set(() => ({
          tags: get().tags.map((tag) =>
            tag.id === tagId
              ? { ...tag, lastUsedAt: new Date().toISOString() }
              : tag
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
        if (migratedTags.some((_tag, index) => !tags[index].path)) {
          set(() => ({ tags: migratedTags }));
        }
      },
      getTagUsageCounts: () => {
        // Get all tags from all current stories
        const allStoryTags = get().stories.flatMap((story) => story.tags || []);
        const allTags = get().tags;

        // Count direct occurrences of each tag ID
        const directCounts: { [tagId: string]: number } = {};
        allStoryTags.forEach((storyTag) => {
          directCounts[storyTag.id] = (directCounts[storyTag.id] || 0) + 1;
        });

        // Calculate total counts including children for categories
        const totalCounts: { [tagId: string]: number } = { ...directCounts };

        // For each tag, if it's a parent category, sum up all descendant counts
        allTags.forEach((tag) => {
          const descendants = allTags.filter((otherTag) => {
            // Check if otherTag is a descendant of tag
            return (
              otherTag.id !== tag.id && // Not the same tag
              otherTag.path.length > tag.path.length && // Descendant must be deeper
              tag.path.every(
                (segment, index) => otherTag.path[index] === segment
              ) // Path must start with parent path
            );
          });

          // Sum up direct counts of all descendants
          const descendantSum = descendants.reduce((sum, descendant) => {
            return sum + (directCounts[descendant.id] || 0);
          }, 0);

          // Add descendant counts to the category's total count
          if (descendantSum > 0) {
            totalCounts[tag.id] = (totalCounts[tag.id] || 0) + descendantSum;
          }
        });

        return totalCounts;
      },
      addHierarchicalTag: (pathString: string) => {
        const path = pathString.split("/").filter((p) => p.trim());
        const fullPath = path.join("/");

        // Check if tag already exists
        const existingTag = get().tags.find((tag) => tag.name === fullPath);
        if (existingTag) {
          return existingTag;
        }

        const currentTags = get().tags;
        const newTags: Tag[] = [];

        // Create entries for ALL levels of the path, not just parent categories
        for (let i = 1; i <= path.length; i++) {
          const currentPath = path.slice(0, i);
          const currentName = currentPath.join("/");

          // Check if this level already exists
          const existingLevel = currentTags.find(
            (tag) => tag.name === currentName
          );
          const alreadyInNewTags = newTags.find(
            (tag) => tag.name === currentName
          );

          if (!existingLevel && !alreadyInNewTags) {
            const newTag: Tag = {
              id: crypto.randomUUID(),
              name: currentName,
              path: currentPath,
              createdAt: new Date().toISOString(),
              lastUsedAt: new Date().toISOString(),
              // Mark as category if it's not the final level
              isCategory: i < path.length,
            };
            newTags.push(newTag);
          }
        }

        // Add all new tags to the store
        if (newTags.length > 0) {
          set(() => ({
            tags: [...get().tags, ...newTags],
          }));
        }

        // Return the final (most specific) tag
        const finalTag =
          newTags.find((tag) => tag.name === fullPath) ||
          get().tags.find((tag) => tag.name === fullPath);
        return finalTag!;
      },
      ensureParentCategories: (path: string[]) => {
        const currentTags = get().tags;
        const newCategories: Tag[] = [];

        // Create parent categories for all levels except the final one
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
              lastUsedAt: new Date().toISOString(),
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

            // Then by last used at (more recently used first)
            const aLastUsedAt = a.lastUsedAt
              ? new Date(a.lastUsedAt).getTime()
              : 0;
            const bLastUsedAt = b.lastUsedAt
              ? new Date(b.lastUsedAt).getTime()
              : 0;
            if (bLastUsedAt !== aLastUsedAt) {
              return bLastUsedAt - aLastUsedAt;
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
        activePromptTemplateId: state.activePromptTemplateId,
        lastUsedPromptTemplateId: state.lastUsedPromptTemplateId,
        promptTemplates: state.promptTemplates,
        editorsNote: state.editorsNote,
        tags: state.tags,
        activeNotesTab: state.activeNotesTab,
        collapsedNoteIds: Array.from(state.collapsedNoteIds),
        collapsedTagIds: Array.from(state.collapsedTagIds),
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Convert arrays back to Sets after rehydration
          state.collapsedNoteIds = new Set(
            state.collapsedNoteIds as unknown as string[]
          );
          state.collapsedTagIds = new Set(
            state.collapsedTagIds as unknown as string[]
          );

          // Migrate old prompt template format to new format
          if (!Array.isArray(state.promptTemplates)) {
            console.log("Migrating old prompt template format to new format");
            const oldPromptTemplates =
              state.promptTemplates as unknown as Record<
                string,
                string | undefined
              >;
            const oldSystemPromptTemplates =
              (
                state as unknown as {
                  systemPromptTemplates?: Record<string, string | undefined>;
                }
              ).systemPromptTemplates || {};

            // Convert old format to new format
            const newPromptTemplates: PromptTemplate[] = [];

            // Handle legacy keys
            const legacyKeys = ["newScene", "rewrite", "summarize"];
            legacyKeys.forEach((key) => {
              if (oldPromptTemplates[key] !== undefined) {
                newPromptTemplates.push({
                  id: key,
                  name:
                    key === "newScene"
                      ? "New Scene"
                      : key === "rewrite"
                      ? "Rewrite"
                      : "Summarize",
                  systemPrompt:
                    oldSystemPromptTemplates[key] ||
                    "You are a helpful AI assistant.",
                  mainPrompt: oldPromptTemplates[key] || "<text>",
                  createdAt: new Date().toISOString(),
                  insertionStrategy:
                    key === "rewrite"
                      ? { kind: "replace-node" }
                      : { kind: "insert-after-node", newParagraph: true },
                });
              }
            });

            // Fallback to defaults if nothing was found
            if (newPromptTemplates.length === 0) {
              newPromptTemplates.push(...defaultPromptTemplates);
            }

            state.promptTemplates = newPromptTemplates;

            // Set active template if needed
            const legacyKey = (
              state as unknown as {
                promptTemplateKey?: string;
              }
            ).promptTemplateKey;
            if (
              !state.activePromptTemplateId ||
              typeof legacyKey === "string"
            ) {
              state.activePromptTemplateId =
                legacyKey || newPromptTemplates[0].id;
            }

            // Clean up old properties
            const anyState = state as unknown as Record<string, unknown>;
            if ("systemPromptTemplates" in anyState) {
              delete anyState.systemPromptTemplates;
            }
            if ("ragPromptTemplates" in anyState) {
              delete anyState.ragPromptTemplates;
            }
            if ("promptTemplateKey" in anyState) {
              delete anyState.promptTemplateKey;
            }
          }
        }
      },
    }
  )
);
