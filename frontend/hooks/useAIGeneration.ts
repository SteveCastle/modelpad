import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $getNodeByKey,
  $createTextNode,
  TextNode,
  LexicalNode,
} from "lexical";
import { useStore, PromptGeneration } from "../store";
import { providers } from "../providers";
import { convertJSONToMarkdown } from "../convertJSONToMarkdown";

// Streaming insertion configuration
export type InsertionStrategy =
  | { kind: "replace-node"; targetNodeKey: string }
  | { kind: "insert-after-node"; targetNodeKey: string; newParagraph?: boolean }
  | {
      kind: "insert-before-node";
      targetNodeKey: string;
      newParagraph?: boolean;
    }
  | { kind: "append-inside-node"; targetNodeKey: string }
  | { kind: "insert-at-cursor" }
  | { kind: "replace-selection" }
  | { kind: "insert-after-selection"; newParagraph?: boolean }
  | { kind: "insert-before-selection"; newParagraph?: boolean }
  | { kind: "append-to-document-end" };

// Enhanced template variable definitions
interface TemplateVariables {
  text: string; // Legacy support - maps to activeNodeText
  activeNodeText: string; // Text of the current/active node
  selection?: string; // Text of any selection (if exists)
  selectionText?: string; // Alias for selection
  contextDocuments: string; // Formatted context documents
  currentDocument: string; // Text of the entire current document
  currentDocumentText: string; // Alias for currentDocument
  textBefore: string; // Text before the active node
  textBeforeActiveNode: string; // Alias for textBefore
  textAfter: string; // Text after the active node
  textAfterActiveNode: string; // Alias for textAfter
  documentContext: string; // Combined before/after context
  editorsNote: string; // Editor's note / guidance
}

function applyTemplate(template: string, context: PromptContext): string {
  // Ensure context is valid
  if (!context || typeof context !== "object") {
    console.error("applyTemplate: Invalid context provided", context);
    return template;
  }

  // Create template variables from context with safety checks
  const variables: TemplateVariables = {
    // Primary text (legacy support)
    text: context.activeNodeText || "",

    // Active node
    activeNodeText: context.activeNodeText || "",

    // Selection (optional)
    selection: context.selectionText || "",
    selectionText: context.selectionText || "",

    // Context documents
    contextDocuments: Array.isArray(context.contextDocuments)
      ? context.contextDocuments.join("\n")
      : "",

    // Current document
    currentDocument: context.currentDocumentText || "",
    currentDocumentText: context.currentDocumentText || "",

    // Before/after context
    textBefore: context.textBeforeActiveNode || "",
    textBeforeActiveNode: context.textBeforeActiveNode || "",
    textAfter: context.textAfterActiveNode || "",
    textAfterActiveNode: context.textAfterActiveNode || "",

    // Combined document context
    documentContext: [
      context.textBeforeActiveNode &&
        `[BEFORE]\n${context.textBeforeActiveNode}`,
      context.textAfterActiveNode && `[AFTER]\n${context.textAfterActiveNode}`,
    ]
      .filter(Boolean)
      .join("\n\n"),

    // Editor's note (present on PromptContext)
    editorsNote:
      (context as PromptContext & { editorsNote?: string }).editorsNote || "",
  };

  // Apply template substitutions
  let result = template || "";

  try {
    // Replace template variables with actual values
    Object.entries(variables).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        // Support both <variable> and {{variable}} syntax
        const patterns = [
          new RegExp(`<${key}>`, "g"),
          new RegExp(`\\{\\{${key}\\}\\}`, "g"),
        ];

        patterns.forEach((pattern) => {
          result = result.replace(pattern, String(value));
        });
      }
    });
  } catch (error) {
    console.error("Error in applyTemplate:", error, { template, context });
    return template;
  }

  return result;
}

// Legacy function for backward compatibility
function applyTemplateLegacy(template: string, text: string) {
  return template.replace("<text>", text);
}

interface PromptContext {
  activeNodeText: string;
  selectionText?: string;
  contextDocuments: string[];
  currentDocumentText: string;
  textBeforeActiveNode: string;
  textAfterActiveNode: string;
  editorsNote?: string;
}

interface PromptBuilderOptions {
  customPrompt?: string;
  promptTemplate: {
    mainPrompt: string;
    systemPrompt: string;
  };
  wordCount?: number;
}

function buildPrompt(
  context: PromptContext,
  options: PromptBuilderOptions
): {
  prompt: string;
  systemPrompt: string;
} {
  const { customPrompt = "", promptTemplate } = options;

  // Build context-aware prompt using enhanced templating

  // Build RAG context section if documents are available
  let basePrompt = promptTemplate.mainPrompt;
  if (context.contextDocuments.length > 0) {
    const ragPrefix = `Below is a list of documents that you can use for context. You can use these documents to help you generate ideas.\n<docs>\n{{contextDocuments}}\nEND OF DOCS\n\n`;
    basePrompt = ragPrefix + basePrompt;
  }

  // Apply enhanced templating to the entire prompt template
  const templatedText = applyTemplate(basePrompt, context);

  // Add custom prompt if provided
  const customPromptText = customPrompt.trim()
    ? `\n\n${customPrompt.trim()}`
    : "";

  // Apply templating to system prompt as well
  const templatedSystemPrompt = applyTemplate(
    promptTemplate.systemPrompt,
    context
  );

  return {
    prompt: templatedText + customPromptText,
    systemPrompt: templatedSystemPrompt,
  };
}

// Helper function to extract context information from the editor
function extractPromptContext(
  _editor: ReturnType<typeof useLexicalComposerContext>[0],
  options: UseAIGenerationOptions,
  tabContext: string[]
): PromptContext {
  let activeNodeText = "";
  let selectionText = "";
  let currentDocumentText = "";
  let textBeforeActiveNode = "";
  let textAfterActiveNode = "";

  try {
    const selection = $getSelection();
    const root = $getRoot();
    currentDocumentText = root.getTextContent() || "";

    // Use custom text if provided
    if (options.customText) {
      activeNodeText = options.customText;
    } else if ($isRangeSelection(selection)) {
      selectionText = selection.getTextContent() || "";
      if (selectionText.length < 2) {
        activeNodeText = currentDocumentText;
        selectionText = "";
      } else {
        activeNodeText = selectionText;
      }
    } else {
      activeNodeText = currentDocumentText;
    }

    // Extract context before/after active node if we have a target node
    if (options.targetNodeKey) {
      const targetNode = $getNodeByKey(options.targetNodeKey);
      if (targetNode) {
        const allChildren = root.getChildren();
        const targetIndex = allChildren.findIndex(
          (child) => child.getKey() === options.targetNodeKey
        );

        if (targetIndex !== -1) {
          // Get text before the target node
          const beforeNodes = allChildren.slice(0, targetIndex);
          textBeforeActiveNode = beforeNodes
            .map((node) => node.getTextContent() || "")
            .join("\n");

          // Get text after the target node
          const afterNodes = allChildren.slice(targetIndex + 1);
          textAfterActiveNode = afterNodes
            .map((node) => node.getTextContent() || "")
            .join("\n");
        }
      }
    }
  } catch (error) {
    console.error("Error in extractPromptContext:", error);
    // Fall back to basic context
    activeNodeText = options.customText || "";
  }

  return {
    activeNodeText: activeNodeText || "",
    selectionText: selectionText || "",
    contextDocuments: Array.isArray(tabContext) ? tabContext : [],
    currentDocumentText: currentDocumentText || "",
    textBeforeActiveNode: textBeforeActiveNode || "",
    textAfterActiveNode: textAfterActiveNode || "",
    editorsNote: useStore.getState().editorsNote || "",
  };
}

// Action types removed; strategy alone governs behavior

// Export the new prompt building functions for potential reuse
export {
  buildPrompt,
  extractPromptContext,
  applyTemplate,
  applyTemplateLegacy,
};
export type { PromptContext, PromptBuilderOptions, TemplateVariables };

interface UseAIGenerationOptions {
  customText?: string; // Optional custom text to use instead of selection/document
  targetNodeKey?: string; // Specify target node for strategy that requires it
  insertionStrategy?: InsertionStrategy; // How streamed tokens should be inserted
}

export function useAIGeneration() {
  const [editor] = useLexicalComposerContext();
  const abortController = useStore((state) => state.abortController);
  const {
    model,
    modelSettings,
    activePromptTemplateId,
    getPromptTemplate,
    useRag,
    addPromptGeneration,
    updatePromptGeneration,
  } = useStore((state) => state);

  const { host, providerKey } = useStore(
    (state) => state.availableServers[state.serverKey]
  );
  const { setGenerationState, updateContext } = useStore((state) => state);
  const stories = useStore((state) => state.stories);
  const activeStoryId = useStore((state) => state.activeStoryId);

  const tabContext = stories
    .filter((story) => story.id !== activeStoryId && story.includeInContext)
    .map((s) => convertJSONToMarkdown(JSON.stringify(s.content)));

  const provider = providers[providerKey];

  // Action-specific callbacks
  const createActionCallbacks = (
    promptId: string | undefined,
    insertionStrategy: InsertionStrategy
  ) => {
    // Track the text node KEY created for streaming output
    // IMPORTANT: do not hold onto node instances across updates
    let currentTextNodeKey: string | null = null;
    // Track generated nodes for undo functionality (especially for prompt-based generate)
    let generatedNodeKeys: string[] = [];

    const startCallback = () => {
      setGenerationState("generating");

      // Update prompt node status if this generation is associated to a promptId
      if (promptId) {
        updatePromptGeneration(promptId, { status: "generating" });

        // Generation state is tracked in the store
      }
    };

    const tokenCallback = (text: string) => {
      editor.update(() => {
        const ensureAppendToCurrentNode = (chunk: string) => {
          if (!currentTextNodeKey) {
            // First token: place a text node according to strategy
            const root = $getRoot();
            const selection = $getSelection();

            const maybeTrackNode = (node: TextNode) => {
              const nodeKey = node.getKey();
              currentTextNodeKey = nodeKey;
              if (!generatedNodeKeys.includes(nodeKey)) {
                generatedNodeKeys.push(nodeKey);
              }
            };

            switch (insertionStrategy.kind) {
              case "replace-node": {
                const target = insertionStrategy.targetNodeKey
                  ? $getNodeByKey(insertionStrategy.targetNodeKey)
                  : undefined;
                if (!target) break;
                const textNode = $createTextNode(chunk);
                const para = $createParagraphNode();
                para.append(textNode);
                if (target.getKey() === "root") {
                  // Cannot replace root; append replacement at end instead
                  const root = $getRoot();
                  root.append(para);
                } else {
                  // If target is not a top-level element, replace its top-level container
                  const topLevel = $isElementNode(target)
                    ? target.getParent()?.getKey() === "root"
                      ? target
                      : target.getTopLevelElementOrThrow()
                    : target.getTopLevelElementOrThrow();
                  topLevel.replace(para);
                }
                maybeTrackNode(textNode);
                textNode.select();
                break;
              }
              case "insert-after-node":
              case "insert-before-node": {
                const node = insertionStrategy.targetNodeKey
                  ? $getNodeByKey(insertionStrategy.targetNodeKey)
                  : undefined;
                if (node) {
                  let elementNode: LexicalNode | null = node;
                  if (!$isElementNode(elementNode)) {
                    elementNode = elementNode.getParent();
                  }
                  if (elementNode && $isElementNode(elementNode)) {
                    // Always use a paragraph as a sibling to avoid illegal root/text placement
                    const textNode = $createTextNode(chunk);
                    const para = $createParagraphNode();
                    para.append(textNode);
                    if (insertionStrategy.kind === "insert-after-node") {
                      elementNode.insertAfter(para);
                    } else {
                      elementNode.insertBefore(para);
                    }
                    maybeTrackNode(textNode);
                    textNode.select();
                  }
                }
                break;
              }
              case "append-inside-node": {
                const target = $getNodeByKey(insertionStrategy.targetNodeKey);
                if (!target) break;
                const element = $isElementNode(target)
                  ? target
                  : target.getParent();
                if (!element || !$isElementNode(element)) break;

                const textNode = $createTextNode(chunk);
                const type = element.getType();
                const isRoot = element.getKey() === "root";
                const acceptsText =
                  type === "paragraph" ||
                  type === "heading" ||
                  type === "quote" ||
                  type === "code";

                if (isRoot) {
                  // Root cannot contain text directly; append new paragraph at end
                  const para = $createParagraphNode();
                  para.append(textNode);
                  element.append(para);
                } else if (acceptsText) {
                  // Safe to append text inside this element
                  element.append(textNode);
                } else {
                  // Fallback: insert a new paragraph after the target element
                  const para = $createParagraphNode();
                  para.append(textNode);
                  element.insertAfter(para);
                }

                maybeTrackNode(textNode);
                textNode.select();
                break;
              }
              case "insert-at-cursor": {
                if ($isRangeSelection(selection)) {
                  const textNode = $createTextNode(chunk);
                  selection.insertNodes([textNode]);
                  maybeTrackNode(textNode);
                  textNode.select();
                }
                break;
              }
              case "replace-selection": {
                if ($isRangeSelection(selection)) {
                  selection.removeText();
                  const textNode = $createTextNode(chunk);
                  selection.insertNodes([textNode]);
                  maybeTrackNode(textNode);
                  textNode.select();
                }
                break;
              }
              case "insert-after-selection":
              case "insert-before-selection": {
                if ($isRangeSelection(selection)) {
                  const focusNode: LexicalNode = selection.focus.getNode();
                  let elementNode: LexicalNode | null = focusNode;
                  if (!$isElementNode(elementNode)) {
                    elementNode = elementNode.getParent();
                  }
                  if (elementNode && $isElementNode(elementNode)) {
                    const textNode = $createTextNode(chunk);
                    const para = $createParagraphNode();
                    para.append(textNode);
                    if (insertionStrategy.kind === "insert-after-selection") {
                      elementNode.insertAfter(para);
                    } else {
                      elementNode.insertBefore(para);
                    }
                    maybeTrackNode(textNode);
                    textNode.select();
                  }
                }
                break;
              }
              case "append-to-document-end":
              default: {
                // Always append a new paragraph at the end for predictable structure
                const para = $createParagraphNode();
                const textNode = $createTextNode(chunk);
                para.append(textNode);
                root.append(para);
                maybeTrackNode(textNode);
                textNode.select();
                break;
              }
            }
          } else {
            // Subsequent tokens: append to existing text node
            const node = currentTextNodeKey
              ? $getNodeByKey(currentTextNodeKey)
              : null;
            if (node && node instanceof TextNode) {
              const current = node.getTextContent();
              node.setTextContent(current + chunk);
              node.select();
            }
          }
        };

        ensureAppendToCurrentNode(text);
      });
    };

    const completedCallback = (context: number[]) => {
      setGenerationState("ready");
      updateContext(activeStoryId, context);

      // Update the generation tracking if this was a prompt-based generation
      if (promptId) {
        const textNodeKeys = generatedNodeKeys;
        updatePromptGeneration(promptId, {
          status: "completed",
          generatedNodeKeys: textNodeKeys,
          canUndo: true,
          canRedo: false,
        });
      }

      // Reset the text node references
      currentTextNodeKey = null;
      generatedNodeKeys = [];
    };

    return { startCallback, tokenCallback, completedCallback };
  };

  const generate = (
    promptTemplateId: string = activePromptTemplateId,
    customPrompt: string = "",
    options: UseAIGenerationOptions = {}
  ) => {
    if (!abortController || !model) return;

    let promptId: string | undefined;

    // Resolve prompt template early for insertion strategy decisions
    const promptTemplate = getPromptTemplate(promptTemplateId);
    if (!promptTemplate) {
      console.error(`Prompt template with id ${promptTemplateId} not found`);
      return;
    }

    // Create generation tracking when we have a specific target node
    if (options.targetNodeKey) {
      promptId = crypto.randomUUID();

      editor.update(() => {
        const targetNode = $getNodeByKey(options.targetNodeKey!);
        console.log("targetNode", targetNode);
        if (targetNode && $isElementNode(targetNode)) {
          // Get the original text content before generation
          const originalText = targetNode.getTextContent();

          // Create generation tracking
          const generation: PromptGeneration = {
            promptId: promptId!,
            storyId: activeStoryId,
            promptNodeKey: targetNode.getKey(), // Track the target element itself
            generatedNodeKeys: [],
            originalContent: originalText,
            status: "pending",
            canUndo: false,
            canRedo: false,
          };

          addPromptGeneration(generation);
        }
      });
    }

    // Determine insertion strategy: options override > template > action fallback
    const strategyFromTemplate = (() => {
      const s = promptTemplate.insertionStrategy;
      if (!s) return undefined;
      switch (s.kind) {
        case "replace-node":
        case "insert-after-node":
        case "insert-before-node":
        case "append-inside-node": {
          if (options.targetNodeKey) {
            return {
              ...s,
              targetNodeKey: options.targetNodeKey,
            } as InsertionStrategy;
          }
          // No target, fall back to append to end
          return { kind: "append-to-document-end" } as InsertionStrategy;
        }
        case "insert-after-selection":
        case "insert-before-selection": {
          return {
            kind: s.kind,
            newParagraph: s.newParagraph,
          } as InsertionStrategy;
        }
        default:
          return { kind: s.kind } as InsertionStrategy;
      }
    })();

    const strategy: InsertionStrategy =
      options.insertionStrategy ||
      strategyFromTemplate ||
      (options.targetNodeKey
        ? {
            kind: "insert-after-node",
            targetNodeKey: options.targetNodeKey,
            newParagraph: true,
          }
        : { kind: "append-to-document-end" });

    const { startCallback, tokenCallback, completedCallback } =
      createActionCallbacks(promptId, strategy);

    editor.update(() => {
      // Extract context information using the new helper function
      const promptContext = extractPromptContext(editor, options, tabContext);

      // Build prompt using the new flexible prompt builder
      const { prompt, systemPrompt } = buildPrompt(promptContext, {
        customPrompt,
        promptTemplate,
      });

      setGenerationState("loading");

      // If not targeting a specific node via promptId, ensure we have a clean paragraph to stream into at end
      if (!promptId) {
        const root = $getRoot();
        const newParagraphNode = $createParagraphNode();
        root.append(newParagraphNode);
      }

      provider.generateText(
        prompt,
        systemPrompt,
        startCallback,
        tokenCallback,
        completedCallback,
        {
          host,
          model,
          abortSignal: abortController.signal,
          context: [],
          modelSettings,
          useRag,
        }
      );
    });
  };

  // Cancel generation function
  const cancelGeneration = (promptId?: string) => {
    if (abortController) {
      abortController.abort();
      setGenerationState("ready");

      if (promptId) {
        updatePromptGeneration(promptId, {
          status: "cancelled",
          canUndo: true, // Allow user to undo (restore original content)
          canRedo: true, // Allow user to redo (retry generation)
        });

        // Generation tracking is handled in the store - no custom node updates needed
      }
    }
  };

  return {
    generate,
    cancelGeneration,
    isGenerating: useStore((state) => state.generationState === "generating"),
    canGenerate: !!(abortController && model),
  };
}
