"use client";
import {
  SparklesIcon,
  ArrowPathIcon,
  ArrowsPointingInIcon,
} from "@heroicons/react/24/outline";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  LexicalEditor,
  ParagraphNode,
} from "lexical";
import {
  TRANSFORMERS,
  $convertFromMarkdownString,
  $convertToMarkdownString,
} from "@lexical/markdown";

import "./ContextMenu.css";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useStore } from "../store";
import { providers } from "../providers";

type PromptGenerator = (text: string) => string;
type PromptTypeKeys = "newScene" | "rewrite" | "summarize";

interface Props {
  editor: LexicalEditor;
  hide: () => void;
}

const promptGenerators: Record<PromptTypeKeys, PromptGenerator> = {
  newScene: (text: string) => {
    return `
     ${text}
     `;
  },
  rewrite: (text: string) => {
    return `A Rewording of this text:
     ${text}

     ALTERNATE VERSION:
     `;
  },
  summarize: (text: string) => {
    return `A summary of the following text:
     ${text}

     BEGIN SUMMARY:
     `;
  },
};

export default function ContextMenu({ hide }: Props) {
  const abortController = useStore((state) => state.abortController);
  const { model, modelSettings, host, providerKey } = useStore(
    (state) => state
  );
  const { setGenerationState, updateContext } = useStore((state) => state);
  const stories = useStore((state) => state.stories);
  const activeStoryId = useStore((state) => state.activeStoryId);
  const activeStory = stories.find((s) => s.id === activeStoryId);
  const context = activeStory?.context;
  const [editor] = useLexicalComposerContext();
  const provider = providers[providerKey];

  const startCallback = () => {
    setGenerationState("generating");
  };

  const tokenCallback = (text: string) => {
    // loop over each character in the text and add it to the new paragraph
    editor.update(() => {
      const root = $getRoot();
      const lastParagraphNode = root.getLastChild() as ParagraphNode;
      const textNode = $createTextNode(text);
      lastParagraphNode.append(textNode);
    });
  };

  function completedCallback(context: number[]) {
    setGenerationState("ready");
    updateContext(activeStoryId, context);
    editor.update(() => {
      const root = $getRoot();
      $convertFromMarkdownString($convertToMarkdownString(TRANSFORMERS, root));
    });
  }

  function generate(promptTypeKey: PromptTypeKeys) {
    if (!abortController || !model) return;
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      const text = selection.getTextContent();
      const prompt = promptGenerators[promptTypeKey](text);
      setGenerationState("loading");
      const root = $getRoot();
      const newParagraphNode = $createParagraphNode();
      root.append(newParagraphNode);
      provider.generateText(
        prompt,
        startCallback,
        tokenCallback,
        completedCallback,
        {
          host,
          model,
          abortSignal: abortController.signal,
          context: context || [],
          modelSettings,
        }
      );
    });
  }

  return (
    <span className={"context-menu"}>
      <button
        type="button"
        onClick={() => {
          hide();
          generate("newScene");
        }}
      >
        <SparklesIcon aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => {
          generate("rewrite");
          hide();
        }}
      >
        <ArrowPathIcon aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => {
          generate("summarize");
          hide();
        }}
      >
        <ArrowsPointingInIcon aria-hidden="true" />
      </button>
    </span>
  );
}
