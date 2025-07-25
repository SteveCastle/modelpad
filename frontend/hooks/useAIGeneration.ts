import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $getNodeByKey,
  LexicalNode,
} from "lexical";
import {
  $createAIGenerationNode,
  $isAIGenerationNode,
  AIGenerationNode,
} from "../components/AIGenerationNode";
import { $createPromptNode, $isPromptNode } from "../components/PromptNode";
import { useStore, PromptTypeKeys, PromptGeneration } from "../store";
import { providers } from "../providers";
import { convertJSONToMarkdown } from "../convertJSONToMarkdown";

function applyTemplate(template: string, text: string) {
  return template.replace("<text>", text);
}

function applyRagTemplate(template: string, text: string) {
  return template.replace("<docs>", text);
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
    promptTemplates,
    systemPromptTemplates,
    ragPromptTemplates,
    useRag,
    addPromptGeneration,
    updatePromptGeneration,
    getPromptGeneration,
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
    let rewriteAINode: AIGenerationNode | null = null; // Track the AI node for rewrite mode
    let generateAINode: AIGenerationNode | null = null; // Track the AI node for generate mode
    let generatedNodeKeys: string[] = []; // Track generated nodes for undo functionality

    const startCallback = () => {
      setGenerationState("generating");

      // Update prompt node status if this is a generate action with a promptId
      if (action === "generate" && promptId) {
        updatePromptGeneration(promptId, { status: "generating" });

        // Update the prompt node in the editor using the generation tracking
        editor.update(() => {
          const generation = getPromptGeneration(promptId);
          if (generation) {
            const promptNode = $getNodeByKey(generation.promptNodeKey);
            if ($isPromptNode(promptNode)) {
              promptNode.setStatus("generating");
            }
          }
        });
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
                if (!generateAINode) {
                  // First token - create AI generation node
                  generateAINode = $createAIGenerationNode(text);

                  // Check if there's already a paragraph after this element that we can append to
                  const nextSibling = elementNode.getNextSibling();
                  if (
                    nextSibling &&
                    $isElementNode(nextSibling) &&
                    nextSibling.getType() === "paragraph"
                  ) {
                    // Append to existing paragraph
                    nextSibling.append(generateAINode);
                  } else {
                    // Create a new paragraph to contain the AI generation node
                    const newParagraph = $createParagraphNode();
                    newParagraph.append(generateAINode);
                    elementNode.insertAfter(newParagraph);
                  }

                  // Track this node for undo functionality
                  const nodeKey = generateAINode.getKey();
                  if (!generatedNodeKeys.includes(nodeKey)) {
                    generatedNodeKeys.push(nodeKey);
                  }
                } else {
                  // Subsequent tokens - append to existing AI generation node
                  const currentText = generateAINode.getTextContent();
                  generateAINode.setTextContent(currentText + text);
                }
              }
            }
          } else {
            // Fallback to original behavior for non-prompt generation
            const root = $getRoot();
            const lastChild = root.getLastChild();

            if (lastChild && $isElementNode(lastChild)) {
              if (!generateAINode) {
                generateAINode = $createAIGenerationNode(text);
                lastChild.append(generateAINode);
              } else {
                const currentText = generateAINode.getTextContent();
                generateAINode.setTextContent(currentText + text);
              }
            }
          }
        } else if (action === "rewrite" && targetNodeKey) {
          // For rewrite, accumulate tokens in the same AI generation node
          if (!rewriteAINode) {
            // First token - clear target and create AI generation node
            const targetNode = $getNodeByKey(targetNodeKey);
            if (targetNode && $isElementNode(targetNode)) {
              targetNode.clear();
              rewriteAINode = $createAIGenerationNode(text);
              targetNode.append(rewriteAINode);
            }
          } else {
            // Subsequent tokens - append to existing AI generation node
            const currentText = rewriteAINode.getTextContent();
            rewriteAINode.setTextContent(currentText + text);
          }
        }
      });
    };

    const completedCallback = (context: number[]) => {
      setGenerationState("ready");
      updateContext(activeStoryId, context);

      editor.update(() => {
        // For AIGenerationNodes, just remove the generation effects but keep them as AIGenerationNodes
        // They will be converted manually when user clicks the convert button
        const root = $getRoot();
        const aiNodes: AIGenerationNode[] = [];

        // Recursively find all AI generation nodes
        function findAINodes(node: LexicalNode): void {
          if ($isAIGenerationNode(node)) {
            aiNodes.push(node);
          }
          if ($isElementNode(node)) {
            const children = node.getChildren();
            for (const child of children) {
              findAINodes(child);
            }
          }
        }

        findAINodes(root);

        // Mark AI nodes as completed (this will remove generation effects via CSS)
        aiNodes.forEach((aiNode) => {
          // Mark the AI node as completed to remove generation effects
          aiNode.setCompleted(true);
        });

        // Update prompt node status to completed if this is a generation with promptId
        if (action === "generate" && promptId) {
          const generation = getPromptGeneration(promptId);
          if (generation) {
            const promptNode = $getNodeByKey(generation.promptNodeKey);
            if ($isPromptNode(promptNode)) {
              promptNode.setStatus("completed");
            }
          }

          // Update the generation tracking - store AI node keys instead of text node keys
          const aiNodeKeys = aiNodes.map((node) => node.getKey());
          updatePromptGeneration(promptId, {
            status: "completed",
            generatedNodeKeys: aiNodeKeys,
            canUndo: true,
            canRedo: false,
          });
        }
      });

      // Reset the rewrite AI node reference
      rewriteAINode = null;
      generateAINode = null;
      generatedNodeKeys = [];
    };

    return { startCallback, tokenCallback, completedCallback };
  };

  const generate = (
    promptTemplateKey: PromptTypeKeys,
    customPrompt: string = "",
    options: UseAIGenerationOptions = {}
  ) => {
    if (!abortController || !model) return;

    const action = options.action || "generate";
    let promptId: string | undefined;

    // Create PromptNode and generation tracking for generate action
    if (action === "generate" && options.targetNodeKey) {
      promptId = crypto.randomUUID();

      editor.update(() => {
        const targetNode = $getNodeByKey(options.targetNodeKey!);
        if (targetNode && $isElementNode(targetNode)) {
          const originalText = targetNode.getTextContent();

          // Create the PromptNode
          const promptNode = $createPromptNode(
            originalText,
            promptId!,
            "pending",
            originalText
          );

          // Clear the element and add PromptNode as child
          targetNode.clear();
          targetNode.append(promptNode);

          // Keep the same targetNodeKey since we're modifying the existing element
          // Store the PromptNode key for tracking
          const actualPromptNodeKey = promptNode.getKey();

          // Create generation tracking
          const generation: PromptGeneration = {
            promptId: promptId!,
            storyId: activeStoryId,
            promptNodeKey: actualPromptNodeKey, // Use the actual PromptNode key
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

      // Build prompt based on action type
      let prompt;
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
      } else {
        // Original generation logic
        const ragText =
          tabContext.length > 0
            ? applyRagTemplate(
                ragPromptTemplates[promptTemplateKey],
                tabContext.join("\n")
              ) + "\n"
            : "";
        const selectedText = applyTemplate(
          promptTemplates[promptTemplateKey],
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
        systemPromptTemplates[promptTemplateKey],
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

        editor.update(() => {
          const generation = getPromptGeneration(promptId);
          if (generation) {
            const promptNode = $getNodeByKey(generation.promptNodeKey);
            if ($isPromptNode(promptNode)) {
              promptNode.setStatus("cancelled");
            }
          }
        });
      }
    }
  };

  // Undo generation function
  const undoGeneration = (promptId: string) => {
    const generation = getPromptGeneration(promptId);
    if (!generation || !generation.canUndo) return;

    editor.update(() => {
      // Remove all generated nodes
      generation.generatedNodeKeys.forEach((nodeKey) => {
        const node = $getNodeByKey(nodeKey);
        if (node) {
          node.remove();
        }
      });

      // Update prompt node - restore original content and set status
      const promptNode = $getNodeByKey(generation.promptNodeKey);
      if ($isPromptNode(promptNode)) {
        // If generation was cancelled, restore original content
        if (generation.status === "cancelled") {
          promptNode.setTextContent(generation.originalContent);
        }
        promptNode.setStatus("completed");
      }
    });

    // Update generation state - clear generated nodes but keep prompt node
    updatePromptGeneration(promptId, {
      generatedNodeKeys: [],
      status: "completed",
      canUndo: false,
      canRedo: true,
    });
  };

  // Regenerate function - clears output and regenerates
  const regenerateGeneration = (promptId: string) => {
    const generation = getPromptGeneration(promptId);
    if (!generation) return;

    editor.update(() => {
      // Remove all generated nodes
      generation.generatedNodeKeys.forEach((nodeKey) => {
        const node = $getNodeByKey(nodeKey);
        if (node) {
          node.remove();
        }
      });

      // Update prompt node status to pending
      const promptNode = $getNodeByKey(generation.promptNodeKey);
      if ($isPromptNode(promptNode)) {
        promptNode.setStatus("pending");
      }
    });

    // Update generation state
    updatePromptGeneration(promptId, {
      status: "pending",
      generatedNodeKeys: [],
      canUndo: false,
      canRedo: false,
    });

    // Find the parent element of the PromptNode to use as targetNodeKey
    editor.getEditorState().read(() => {
      const promptNode = $getNodeByKey(generation.promptNodeKey);
      if ($isPromptNode(promptNode)) {
        const parentElement = promptNode.getParent();
        if (parentElement && $isElementNode(parentElement)) {
          // Re-trigger generation using the parent element as target
          generate("newScene", "", {
            customText: generation.originalContent,
            action: "generate",
            targetNodeKey: parentElement.getKey(),
          });
        }
      }
    });
  };

  // Redo generation function
  const redoGeneration = (promptId: string) => {
    const generation = getPromptGeneration(promptId);
    if (!generation || !generation.canRedo) return;

    // Update prompt node status to pending
    editor.update(() => {
      const promptNode = $getNodeByKey(generation.promptNodeKey);
      if ($isPromptNode(promptNode)) {
        promptNode.setStatus("pending");
      }
    });

    // Update the generation tracking
    updatePromptGeneration(promptId, {
      status: "pending",
      canUndo: false,
      canRedo: false,
      generatedNodeKeys: [],
    });

    // Find the parent element of the PromptNode to use as targetNodeKey
    editor.getEditorState().read(() => {
      const promptNode = $getNodeByKey(generation.promptNodeKey);
      if ($isPromptNode(promptNode)) {
        const parentElement = promptNode.getParent();
        if (parentElement && $isElementNode(parentElement)) {
          // Re-trigger generation using the parent element as target
          generate("newScene", "", {
            customText: generation.originalContent,
            action: "generate",
            targetNodeKey: parentElement.getKey(),
          });
        }
      }
    });
  };

  return {
    generate,
    cancelGeneration,
    undoGeneration,
    redoGeneration,
    regenerateGeneration,
    isGenerating: useStore((state) => state.generationState === "generating"),
    canGenerate: !!(abortController && model),
  };
}
