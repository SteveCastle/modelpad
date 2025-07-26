import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $getNodeByKey,
  LexicalNode,
  ParagraphNode,
} from "lexical";
import {
  $createAIGenerationNode,
  $isAIGenerationNode,
  AIGenerationNode,
} from "../components/AIGenerationNode";
import {
  TRANSFORMERS,
  $convertFromMarkdownString,
  $convertToMarkdownString,
} from "@lexical/markdown";
import { useStore, PromptTypeKeys } from "../store";
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
    targetNodeKey?: string
  ) => {
    let rewriteAINode: AIGenerationNode | null = null; // Track the AI node for rewrite mode

    const startCallback = () => {
      setGenerationState("generating");
    };

    const tokenCallback = (text: string) => {
      editor.update(() => {
        if (action === "generate") {
          // Add new content at the end
          const root = $getRoot();
          const lastParagraphNode = root.getLastChild() as ParagraphNode;
          const aiGenerationNode = $createAIGenerationNode(text);
          lastParagraphNode.append(aiGenerationNode);
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
        const root = $getRoot();

        // Convert all AI generation nodes to regular text nodes
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

        aiNodes.forEach((aiNode) => {
          const textNode = aiNode.convertToTextNode();
          aiNode.replace(textNode);
        });

        // Then apply markdown formatting
        $convertFromMarkdownString(
          $convertToMarkdownString(TRANSFORMERS, root)
        );
      });

      // Reset the rewrite AI node reference
      rewriteAINode = null;
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
    const { startCallback, tokenCallback, completedCallback } =
      createActionCallbacks(action, options.targetNodeKey);

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

      // Only add new paragraph for generate action, not rewrite
      if (action === "generate") {
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

  return {
    generate,
    isGenerating: useStore((state) => state.generationState === "generating"),
    canGenerate: !!(abortController && model),
  };
}
