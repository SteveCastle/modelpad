"use client";
import {
  SparklesIcon,
  ArrowPathIcon,
  ArrowsPointingInIcon,
} from "@heroicons/react/24/outline";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  LexicalEditor,
  LexicalNode,
  ParagraphNode,
} from "lexical";
import {
  $createAIGenerationNode,
  $isAIGenerationNode,
  AIGenerationNode,
} from "./AIGenerationNode";
import {
  TRANSFORMERS,
  $convertFromMarkdownString,
  $convertToMarkdownString,
} from "@lexical/markdown";

import "./ContextMenu.css";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useStore, PromptTypeKeys } from "../store";
import { providers } from "../providers";
import { useState } from "react";
import { convertJSONToMarkdown } from "../convertJSONToMarkdown";
import useCtrlHotkey from "../hooks/useCtrlHotkey";

interface Props {
  editor: LexicalEditor;
  hide: () => void;
}

function applyTemplate(template: string, text: string) {
  return template.replace("<text>", text);
}

function applyRagTemplate(template: string, text: string) {
  return template.replace("<docs>", text);
}

export default function ContextMenu({ hide }: Props) {
  const [selectedPrompt, setSelectedPrompt] =
    useState<PromptTypeKeys>("newScene");
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
  const [editor] = useLexicalComposerContext();
  const { setGenerationState, updateContext } = useStore((state) => state);
  const stories = useStore((state) => state.stories);
  const activeStoryId = useStore((state) => state.activeStoryId);

  const tabContext = stories
    .filter((story) => story.id !== activeStoryId && story.includeInContext)
    .map((s) => convertJSONToMarkdown(JSON.stringify(s.content)));

  const provider = providers[providerKey];

  // Get context pills showing what's included in the prompt
  const getContextPills = () => {
    const pills = [];
    let hasSelection = false;

    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const selectedText = selection.getTextContent();
        if (selectedText.length >= 2) {
          hasSelection = true;
        }
      }
    });

    // Add selection or current document pill
    if (hasSelection) {
      pills.push({ type: "selection", label: "Selection" });
    } else {
      pills.push({ type: "document", label: "Current Document" });
    }

    // Add RAG document pills
    const ragStories = stories
      .filter((story) => story.id !== activeStoryId && story.includeInContext)
      .map((story) => ({ type: "rag", label: story.title }));

    pills.push(...ragStories);

    return pills;
  };

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

  function completedCallback(context: number[]) {
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
  }

  function generate(promptTemplateKey: PromptTypeKeys) {
    if (!abortController || !model) return;
    editor.update(() => {
      const selection = $getSelection();
      const root = $getRoot();
      let text;
      if ($isRangeSelection(selection)) {
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
      const prompt = ragText + selectedText;
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
  }

  useCtrlHotkey(() => {
    generate("newScene");
  }, " ");

  return (
    <div className={"context-menu-container"}>
      <div className={"context-menu"}>
        <div className={"button-area"}>
          <button
            type="button"
            className={`new-scene-button ${
              selectedPrompt === "newScene" ? "active" : ""
            }`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedPrompt("newScene");
            }}
          >
            <SparklesIcon aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`rewrite-button ${
              selectedPrompt === "rewrite" ? "active" : ""
            }`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedPrompt("rewrite");
            }}
          >
            <ArrowPathIcon aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`summarize-button ${
              selectedPrompt === "summarize" ? "active" : ""
            }`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedPrompt("summarize");
            }}
          >
            <ArrowsPointingInIcon aria-hidden="true" />
          </button>
          <button
            type="button"
            className="generate-button"
            onClick={() => {
              hide();
              generate(selectedPrompt);
            }}
          >
            <span className="generate-text">Generate</span>
            <span className="hotkey">CTRL+SPACE</span>
          </button>
        </div>
        <div className="context-pills-area">
          <div className="context-pills">
            {getContextPills().map((pill, index) => (
              <span key={index} className={`context-pill ${pill.type}`}>
                {pill.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
