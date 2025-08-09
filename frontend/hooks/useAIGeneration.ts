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
} from "lexical";
import { useStore, PromptGeneration } from "../store";
import { providers } from "../providers";
import { convertJSONToMarkdown } from "../convertJSONToMarkdown";

function applyTemplate(template: string, text: string) {
  return template.replace("<text>", text);
}


export type AIActionType = "generate" | "rewrite";

interface UseAIGenerationOptions {
  customText?: string; // Optional custom text to use instead of selection/document
  targetNodeKey?: string; // For rewrite action, specify which node to replace
  action?: AIActionType; // Type of AI action to perform
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
    targetNodeKey?: string,
    promptId?: string
  ) => {
    let rewriteTextNode: TextNode | null = null; // Track the text node for rewrite mode
    let generateTextNode: TextNode | null = null; // Track the text node for generate mode
    let generatedNodeKeys: string[] = []; // Track generated nodes for undo functionality

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
        if (action === "generate") {
          // Add new content after the prompt element for generate action
          if (promptId && targetNodeKey) {
            const targetNode = $getNodeByKey(targetNodeKey);
            if (targetNode) {
              // Find the top-level element node that contains or is the target
              let elementNode = targetNode;
              if (!$isElementNode(elementNode)) {
                elementNode = elementNode.getParent();
              }

              if (elementNode && $isElementNode(elementNode)) {
                if (!generateTextNode) {
                  // First token - create regular text node
                  generateTextNode = $createTextNode(text);

                  const newParagraph = $createParagraphNode();
                  newParagraph.append(generateTextNode);
                  elementNode.insertAfter(newParagraph);

                  // Track this node for undo functionality
                  const nodeKey = generateTextNode.getKey();
                  if (!generatedNodeKeys.includes(nodeKey)) {
                    generatedNodeKeys.push(nodeKey);
                  }
                } else {
                  // Subsequent tokens - append to existing text node
                  const currentText = generateTextNode.getTextContent();
                  generateTextNode.setTextContent(currentText + text);
                }
              }
            }
          } else {
            // Fallback to original behavior for non-prompt generation
            const root = $getRoot();
            const lastChild = root.getLastChild();

            if (lastChild && $isElementNode(lastChild)) {
              if (!generateTextNode) {
                generateTextNode = $createTextNode(text);
                lastChild.append(generateTextNode);
              } else {
                const currentText = generateTextNode.getTextContent();
                generateTextNode.setTextContent(currentText + text);
              }
            }
          }
        } else if (action === "rewrite" && targetNodeKey) {
          // For rewrite, accumulate tokens in the same text node
          if (!rewriteTextNode) {
            // First token - clear target and create text node
            const targetNode = $getNodeByKey(targetNodeKey);
            if (targetNode && $isElementNode(targetNode)) {
              targetNode.clear();
              rewriteTextNode = $createTextNode(text);
              targetNode.append(rewriteTextNode);
            }
          } else {
            // Subsequent tokens - append to existing text node
            const currentText = rewriteTextNode.getTextContent();
            rewriteTextNode.setTextContent(currentText + text);
          }
        }
      });
    };

    const completedCallback = (context: number[]) => {
      setGenerationState("ready");
      updateContext(activeStoryId, context);

      // Update the generation tracking if this was a prompt-based generation
      if (action === "generate" && promptId) {
        const textNodeKeys = generateTextNode ? [generateTextNode.getKey()] : generatedNodeKeys;
        updatePromptGeneration(promptId, {
          status: "completed",
          generatedNodeKeys: textNodeKeys,
          canUndo: true,
          canRedo: false,
        });
      }

      // Reset the text node references
      rewriteTextNode = null;
      generateTextNode = null;
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

    const { startCallback, tokenCallback, completedCallback } =
      createActionCallbacks(action, options.targetNodeKey, promptId);

    editor.update(() => {
      const selection = $getSelection();
      const root = $getRoot();
      let text;

      // Use custom text if provided, otherwise use selection or document
      if (options.customText) {
        text = options.customText;
      } else if ($isRangeSelection(selection)) {
        text = selection.getTextContent();
        if (text.length < 2) {
          text = root.getTextContent();
        }
      } else {
        text = root.getTextContent();
      }

      // Get the prompt template
      const promptTemplate = getPromptTemplate(promptTemplateId);
      if (!promptTemplate) {
        console.error(`Prompt template with id ${promptTemplateId} not found`);
        return;
      }

      // Build prompt based on action type
      let prompt;
      let systemPrompt = promptTemplate.systemPrompt;
      
      if (action === "rewrite") {
        // For rewrite, construct a prompt that emphasizes one-to-one replacement and length matching
        const wordCount = text
          .split(/\s+/)
          .filter((word) => word.length > 0).length;
        const baseRewritePrompt = `You are rewriting text as a direct, one-to-one replacement. Your output should match the approximate length of the input (${wordCount} words). Write ONLY the rewritten text with no additional commentary or explanation.`;

        const rewriteInstructions = customPrompt.trim()
          ? `\n\nRewrite instructions: ${customPrompt.trim()}`
          : `\n\nImprove clarity, style, and flow while maintaining the same meaning and approximate length.`;

        prompt = `${baseRewritePrompt}${rewriteInstructions}\n\nOriginal text to rewrite:\n${text}`;
        systemPrompt = baseRewritePrompt; // Override system prompt for rewrite
      } else {
        // Original generation logic
        const ragText =
          tabContext.length > 0
            ? `Below is a list of documents that you can use for context. You can use these documents to help you generate ideas.\n<docs>\n${tabContext.join("\n")}\nEND OF DOCS\n`
            : "";
        const selectedText = applyTemplate(
          promptTemplate.mainPrompt,
          text
        );
        const customPromptText = customPrompt.trim()
          ? `\n\n${customPrompt.trim()}`
          : "";
        prompt = ragText + selectedText + customPromptText;
      }

      setGenerationState("loading");

      // Only add new paragraph for generate action if not using PromptNode workflow
      if (action === "generate" && !promptId) {
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
