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
}

interface PromptBuilderOptions {
  action: AIActionType;
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
  const { action, customPrompt = "", promptTemplate, wordCount } = options;

  // For rewrite actions, build a specialized prompt
  if (action === "rewrite") {
    const actualWordCount =
      wordCount ||
      context.activeNodeText.split(/\s+/).filter((word) => word.length > 0)
        .length;

    const baseRewritePrompt = `You are rewriting text as a direct, one-to-one replacement. Your output should match the approximate length of the input (${actualWordCount} words). Write ONLY the rewritten text with no additional commentary or explanation.`;

    const rewriteInstructions = customPrompt.trim()
      ? `\n\nRewrite instructions: ${customPrompt.trim()}`
      : `\n\nImprove clarity, style, and flow while maintaining the same meaning and approximate length.`;

    // Create a template for rewrite that can use all context variables
    const rewriteTemplate = `${baseRewritePrompt}${rewriteInstructions}\n\nOriginal text to rewrite:\n{{activeNodeText}}`;

    return {
      prompt: applyTemplate(rewriteTemplate, context),
      systemPrompt: applyTemplate(baseRewritePrompt, context),
    };
  }

  // For generate actions, build context-aware prompt using enhanced templating

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
  };
}

export type AIActionType = "generate" | "rewrite";

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
  targetNodeKey?: string; // For rewrite action, specify which node to replace
  action?: AIActionType; // Type of AI action to perform
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
    action: AIActionType,
    promptId: string | undefined,
    insertionStrategy: InsertionStrategy
  ) => {
    // Track the text node created for streaming output
    let currentTextNode: TextNode | null = null;
    // Track generated nodes for undo functionality (especially for prompt-based generate)
    let generatedNodeKeys: string[] = [];

    const startCallback = () => {
      setGenerationState("generating");

      // Update prompt node status if this is a generate action with a promptId
      if (action === "generate" && promptId) {
        updatePromptGeneration(promptId, { status: "generating" });

        // Generation state is tracked in the store
      }
    };

    const tokenCallback = (text: string) => {
      editor.update(() => {
        const ensureAppendToCurrentNode = (chunk: string) => {
          if (!currentTextNode) {
            // First token: place a text node according to strategy
            const root = $getRoot();
            const selection = $getSelection();

            const maybeTrackNode = (node: TextNode) => {
              currentTextNode = node;
              const nodeKey = node.getKey();
              if (!generatedNodeKeys.includes(nodeKey)) {
                generatedNodeKeys.push(nodeKey);
              }
            };

            switch (insertionStrategy.kind) {
              case "replace-node": {
                const node = insertionStrategy.targetNodeKey
                  ? $getNodeByKey(insertionStrategy.targetNodeKey)
                  : undefined;
                if (node && $isElementNode(node)) {
                  node.clear();
                  const textNode = $createTextNode(chunk);
                  node.append(textNode);
                  maybeTrackNode(textNode);
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
                    if (insertionStrategy.newParagraph !== false) {
                      const para = $createParagraphNode();
                      para.append(textNode);
                      if (insertionStrategy.kind === "insert-after-node") {
                        elementNode.insertAfter(para);
                      } else {
                        elementNode.insertBefore(para);
                      }
                    } else {
                      if (insertionStrategy.kind === "insert-after-node") {
                        elementNode.insertAfter(textNode);
                      } else {
                        elementNode.insertBefore(textNode);
                      }
                    }
                    maybeTrackNode(textNode);
                  }
                }
                break;
              }
              case "append-inside-node": {
                const node = $getNodeByKey(insertionStrategy.targetNodeKey);
                if (node && $isElementNode(node)) {
                  const textNode = $createTextNode(chunk);
                  node.append(textNode);
                  maybeTrackNode(textNode);
                }
                break;
              }
              case "insert-at-cursor": {
                if ($isRangeSelection(selection)) {
                  const textNode = $createTextNode(chunk);
                  selection.insertNodes([textNode]);
                  maybeTrackNode(textNode);
                }
                break;
              }
              case "replace-selection": {
                if ($isRangeSelection(selection)) {
                  selection.removeText();
                  const textNode = $createTextNode(chunk);
                  selection.insertNodes([textNode]);
                  maybeTrackNode(textNode);
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
                  }
                }
                break;
              }
              case "append-to-document-end":
              default: {
                const lastChild = root.getLastChild();
                if (lastChild && $isElementNode(lastChild)) {
                  const textNode = $createTextNode(chunk);
                  lastChild.append(textNode);
                  maybeTrackNode(textNode);
                } else {
                  const para = $createParagraphNode();
                  const textNode = $createTextNode(chunk);
                  para.append(textNode);
                  root.append(para);
                  maybeTrackNode(textNode);
                }
                break;
              }
            }
          } else {
            // Subsequent tokens: append to existing text node
            const current = currentTextNode.getTextContent();
            currentTextNode.setTextContent(current + chunk);
          }
        };

        ensureAppendToCurrentNode(text);
      });
    };

    const completedCallback = (context: number[]) => {
      setGenerationState("ready");
      updateContext(activeStoryId, context);

      // Update the generation tracking if this was a prompt-based generation
      if (action === "generate" && promptId) {
        const textNodeKeys = generatedNodeKeys;
        updatePromptGeneration(promptId, {
          status: "completed",
          generatedNodeKeys: textNodeKeys,
          canUndo: true,
          canRedo: false,
        });
      }

      // Reset the text node references
      currentTextNode = null;
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

    const action = options.action || "generate";
    let promptId: string | undefined;

    // Create generation tracking for generate action
    if (action === "generate" && options.targetNodeKey) {
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

    // Determine insertion strategy based on action and provided options
    const strategy: InsertionStrategy =
      options.insertionStrategy ||
      (action === "generate"
        ? options.targetNodeKey
          ? {
              kind: "insert-after-node",
              targetNodeKey: options.targetNodeKey,
              newParagraph: true,
            }
          : { kind: "append-to-document-end" }
        : options.targetNodeKey
        ? { kind: "replace-node", targetNodeKey: options.targetNodeKey }
        : { kind: "insert-at-cursor" });

    const { startCallback, tokenCallback, completedCallback } =
      createActionCallbacks(action, promptId, strategy);

    editor.update(() => {
      // Get the prompt template
      const promptTemplate = getPromptTemplate(promptTemplateId);
      if (!promptTemplate) {
        console.error(`Prompt template with id ${promptTemplateId} not found`);
        return;
      }

      // Extract context information using the new helper function
      const promptContext = extractPromptContext(editor, options, tabContext);

      // Build prompt using the new flexible prompt builder
      const { prompt, systemPrompt } = buildPrompt(promptContext, {
        action,
        customPrompt,
        promptTemplate,
      });

      setGenerationState("loading");

      // Only add new paragraph for generate action if not using PromptNode workflow
      if (action === "generate" && !promptId) {
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
