import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect, useRef } from "react";
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
import { useShallow } from "zustand/react/shallow";
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
  const { promptTemplate } = options;

  // Build context-aware prompt using enhanced templating

  // Build RAG context section if documents are available
  let basePrompt = promptTemplate.mainPrompt;
  if (context.contextDocuments.length > 0) {
    const ragPrefix = `Below is a list of documents that you can use for context. You can use these documents to help you generate ideas.\n<docs>\n{{contextDocuments}}\nEND OF DOCS\n\n`;
    basePrompt = ragPrefix + basePrompt;
  }

  // Apply enhanced templating to the entire prompt template
  const templatedText = applyTemplate(basePrompt, context);

  // Apply templating to system prompt as well
  const templatedSystemPrompt = applyTemplate(
    promptTemplate.systemPrompt,
    context
  );

  return {
    prompt: templatedText,
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

    if ($isRangeSelection(selection)) {
      selectionText = selection.getTextContent() || "";
    }

    // Prefer explicit target node when provided and still attached
    const computeAroundTopLevelKey = (topLevelKey: string) => {
      const allChildren = root.getChildren();
      const targetIndex = allChildren.findIndex(
        (child) => child.getKey() === topLevelKey
      );
      if (targetIndex === -1) return;
      const target = allChildren[targetIndex];
      activeNodeText = target.getTextContent() || "";
      const beforeNodes = allChildren.slice(0, targetIndex);
      textBeforeActiveNode = beforeNodes
        .map((node) => node.getTextContent() || "")
        .join("\n");
      const afterNodes = allChildren.slice(targetIndex + 1);
      textAfterActiveNode = afterNodes
        .map((node) => node.getTextContent() || "")
        .join("\n");
    };

    if (options.targetNodeKey) {
      const targetNode = $getNodeByKey(options.targetNodeKey);
      if (targetNode) {
        // Use the provided top-level key directly
        computeAroundTopLevelKey(options.targetNodeKey);
      }
    }

    // If we couldn't resolve via targetNodeKey, fall back to selection's top-level element
    if (!activeNodeText) {
      const maybeSelection = $getSelection();
      if ($isRangeSelection(maybeSelection)) {
        const topLevel = maybeSelection.anchor
          .getNode()
          .getTopLevelElementOrThrow();
        computeAroundTopLevelKey(topLevel.getKey());
      }
    }
  } catch (error) {
    console.error("Error in extractPromptContext:", error);
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
  targetNodeKey?: string; // Specify target node for strategy that requires it
  insertionStrategy?: InsertionStrategy; // How streamed tokens should be inserted
}

export function useAIGeneration() {
  const [editor] = useLexicalComposerContext();
  // Track last non-empty selection to survive focus changes
  const lastSelectionTextRef = useRef<string>("");
  const abortController = useStore((state) => state.abortController);
  const {
    model,
    modelSettings,
    activePromptTemplateId,
    lastUsedPromptTemplateId,
    getPromptTemplate,
    useRag,
    addPromptGeneration,
    updatePromptGeneration,
  } = useStore((state) => state);

  const { host, providerKey } = useStore(
    useShallow((state) => state.availableServers[state.serverKey])
  );
  const { setGenerationState, updateContext } = useStore((state) => state);
  const setLastUsedPromptTemplate = useStore(
    (state) => state.setLastUsedPromptTemplate
  );
  const promptTemplates = useStore((state) => state.promptTemplates);
  const stories = useStore((state) => state.stories);
  const activeStoryId = useStore((state) => state.activeStoryId);

  const tabContext = stories
    .filter((story) => story.id !== activeStoryId && story.includeInContext)
    .map((s) => convertJSONToMarkdown(JSON.stringify(s.content)));

  const provider = providers[providerKey];

  // Update last selection text on editor updates
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        try {
          const selection = $getSelection();
          if ($isRangeSelection(selection) && !selection.isCollapsed()) {
            const text = selection.getTextContent() || "";
            if (text) {
              lastSelectionTextRef.current = text;
            }
          }
        } catch (e) {
          // ignore selection read errors
        }
      });
    });
  }, [editor]);

  // Action-specific callbacks
  const createActionCallbacks = (
    promptId: string | undefined,
    insertionStrategy: InsertionStrategy
  ) => {
    // Track the text node KEY created for streaming output
    // IMPORTANT: do not hold onto node instances across updates
    let currentTextNodeKey: string | null = null;
    // Track the container (paragraph/heading/etc.) that holds the streaming text
    let currentContainerKey: string | null = null;

    const getLastTextNodeIn = (
      containerKey: string | null
    ): TextNode | null => {
      if (!containerKey) return null;
      const container = $getNodeByKey(containerKey);
      if (!container || !$isElementNode(container)) return null;
      const children = container.getChildren();
      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i];
        if (child instanceof TextNode) return child;
        if ($isElementNode(child)) {
          const deep = getLastTextNodeIn(child.getKey());
          if (deep) return deep;
        }
      }
      return null;
    };

    const trackStreamingTargets = (
      textNode: TextNode,
      containerNode: LexicalNode | null | undefined
    ) => {
      const container =
        containerNode && $isElementNode(containerNode)
          ? containerNode
          : textNode.getParent();
      currentContainerKey =
        container && $isElementNode(container) ? container.getKey() : null;
      // Use actual text node if still attached, else recover from container
      const effective = textNode.getParent()
        ? textNode
        : getLastTextNodeIn(currentContainerKey);
      if (effective) {
        currentTextNodeKey = effective.getKey();
      }
    };
    // Track generated nodes for undo functionality (especially for prompt-based generate)
    let generatedNodeKeys: string[] = [];

    // Buffer to ensure in-order insertion and reduce Lexical update churn
    let tokenBuffer: string[] = [];
    let flushScheduled = false;

    const scheduleFlush = () => {
      if (flushScheduled) return;
      flushScheduled = true;
      Promise.resolve().then(() => {
        flushScheduled = false;
        if (tokenBuffer.length === 0) return;
        const buffered = tokenBuffer.join("");
        tokenBuffer = [];
        // Single editor.update to apply all pending text in order
        editor.update(() => {
          const ensureAppendToCurrentNode = (chunk: string) => {
            if (!currentTextNodeKey) {
              // First token: place a text node according to strategy

              const maybeTrackNode = (
                node: TextNode,
                container?: LexicalNode | null
              ) => {
                trackStreamingTargets(node, container);
                if (
                  currentTextNodeKey &&
                  !generatedNodeKeys.includes(currentTextNodeKey)
                ) {
                  generatedNodeKeys.push(currentTextNodeKey);
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
                    const root = $getRoot();
                    root.append(para);
                    maybeTrackNode(textNode, para);
                  } else {
                    const topLevel = $isElementNode(target)
                      ? target.getParent()?.getKey() === "root"
                        ? target
                        : target.getTopLevelElementOrThrow()
                      : target.getTopLevelElementOrThrow();
                    topLevel.replace(para);
                    maybeTrackNode(textNode, para);
                  }
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
                      const textNode = $createTextNode(chunk);
                      const para = $createParagraphNode();
                      para.append(textNode);
                      if (insertionStrategy.kind === "insert-after-node") {
                        elementNode.insertAfter(para);
                      } else {
                        elementNode.insertBefore(para);
                      }
                      maybeTrackNode(textNode, para);
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
                    const para = $createParagraphNode();
                    para.append(textNode);
                    element.append(para);
                    maybeTrackNode(textNode, para);
                  } else if (acceptsText) {
                    element.append(textNode);
                    maybeTrackNode(textNode, element);
                  } else {
                    const para = $createParagraphNode();
                    para.append(textNode);
                    element.insertAfter(para);
                    maybeTrackNode(textNode, para);
                  }
                  break;
                }
                case "insert-at-cursor": {
                  const selection = $getSelection();
                  if ($isRangeSelection(selection)) {
                    const textNode = $createTextNode(chunk);
                    selection.insertNodes([textNode]);
                    maybeTrackNode(textNode, textNode.getParent());
                  }
                  break;
                }
                case "replace-selection": {
                  const selection = $getSelection();
                  if ($isRangeSelection(selection)) {
                    selection.removeText();
                    const textNode = $createTextNode(chunk);
                    selection.insertNodes([textNode]);
                    maybeTrackNode(textNode, textNode.getParent());
                  }
                  break;
                }
                case "insert-after-selection":
                case "insert-before-selection": {
                  const selection = $getSelection();
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
                      maybeTrackNode(textNode, para);
                    }
                  }
                  break;
                }
                case "append-to-document-end":
                default: {
                  const para = $createParagraphNode();
                  const textNode = $createTextNode(chunk);
                  para.append(textNode);
                  const root = $getRoot();
                  root.append(para);
                  maybeTrackNode(textNode, para);
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
              } else {
                // Recovery: if the original text node was merged/detached, pick the last text node in container
                const fallback = getLastTextNodeIn(currentContainerKey);
                if (fallback) {
                  currentTextNodeKey = fallback.getKey();
                  const current = fallback.getTextContent();
                  fallback.setTextContent(current + chunk);
                } else {
                  // Last resort: append a new paragraph at the end
                  const para = $createParagraphNode();
                  const textNode = $createTextNode(chunk);
                  para.append(textNode);
                  $getRoot().append(para);
                  trackStreamingTargets(textNode, para);
                }
              }
            }
          };

          ensureAppendToCurrentNode(buffered);
        });
      });
    };

    const startCallback = () => {
      setGenerationState("generating");

      // Update prompt node status if this generation is associated to a promptId
      if (promptId) {
        updatePromptGeneration(promptId, { status: "generating" });

        // Generation state is tracked in the store
      }
    };

    const tokenCallback = (text: string) => {
      // Accumulate and flush in order via microtask to avoid out-of-order updates
      if (!text) return;
      tokenBuffer.push(text);
      scheduleFlush();
    };

    const completedCallback = (context: number[]) => {
      // Flush any remaining buffered content before completing
      if (tokenBuffer.length > 0) {
        const remaining = tokenBuffer.join("");
        tokenBuffer = [];
        editor.update(() => {
          const node = currentTextNodeKey
            ? $getNodeByKey(currentTextNodeKey)
            : null;
          if (node && node instanceof TextNode) {
            const current = node.getTextContent();
            node.setTextContent(current + remaining);
          } else {
            const fallback = getLastTextNodeIn(currentContainerKey);
            if (fallback) {
              currentTextNodeKey = fallback.getKey();
              const current = fallback.getTextContent();
              fallback.setTextContent(current + remaining);
            } else {
              const para = $createParagraphNode();
              const textNode = $createTextNode(remaining);
              para.append(textNode);
              $getRoot().append(para);
              trackStreamingTargets(textNode, para);
            }
          }
        });
      }
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
      tokenBuffer = [];
      flushScheduled = false;
    };

    return { startCallback, tokenCallback, completedCallback };
  };

  const generate = (
    promptTemplateId?: string,
    options: UseAIGenerationOptions = {}
  ) => {
    if (!abortController || !model) return;

    let promptId: string | undefined;

    // Determine which template to use: explicit -> lastUsed -> active -> first available
    const resolvedTemplateId =
      promptTemplateId ||
      lastUsedPromptTemplateId ||
      activePromptTemplateId ||
      (promptTemplates.length > 0 ? promptTemplates[0].id : "");

    // Resolve prompt template early for insertion strategy decisions
    const promptTemplate = getPromptTemplate(resolvedTemplateId);
    if (!promptTemplate) {
      console.error(`Prompt template with id ${resolvedTemplateId} not found`);
      return;
    }

    // Record most recently used template
    setLastUsedPromptTemplate(resolvedTemplateId);

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

    // Read the freshest editor state snapshot for prompt building
    const promptContext = editor.getEditorState().read(() => {
      const ctx = extractPromptContext(editor, options, tabContext);
      // Fallback to last known selection only for selectionText; do not override active node text
      if (
        (!ctx.selectionText || ctx.selectionText.length === 0) &&
        lastSelectionTextRef.current
      ) {
        return { ...ctx, selectionText: lastSelectionTextRef.current };
      }
      return ctx;
    });

    // Build prompt outside of any write update
    const { prompt, systemPrompt } = buildPrompt(promptContext, {
      promptTemplate,
    });

    setGenerationState("loading");

    // Optionally prepare an insertion point at end for non-targeted generations
    if (!promptId) {
      editor.update(() => {
        const root = $getRoot();
        const newParagraphNode = $createParagraphNode();
        root.append(newParagraphNode);
      });
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
