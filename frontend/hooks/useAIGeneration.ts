import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
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

interface UseAIGenerationOptions {
  customText?: string; // Optional custom text to use instead of selection/document
  insertAfterNode?: boolean; // If true, insert after current node instead of at end
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

  const startCallback = () => {
    setGenerationState("generating");
  };

  const tokenCallback = (text: string) => {
    // loop over each character in the text and add it to the new paragraph using AI generation node
    editor.update(() => {
      const root = $getRoot();
      const lastParagraphNode = root.getLastChild() as ParagraphNode;
      const aiGenerationNode = $createAIGenerationNode(text);
      lastParagraphNode.append(aiGenerationNode);
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
      $convertFromMarkdownString($convertToMarkdownString(TRANSFORMERS, root));
    });
  };

  const generate = (
    promptTemplateKey: PromptTypeKeys,
    customPrompt: string = "",
    options: UseAIGenerationOptions = {}
  ) => {
    if (!abortController || !model) return;

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
      const prompt = ragText + selectedText + customPromptText;

      setGenerationState("loading");
      const newParagraphNode = $createParagraphNode();
      root.append(newParagraphNode);

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
