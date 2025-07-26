"use client";
import {
  SparklesIcon,
  ArrowPathIcon,
  ArrowsPointingInIcon,
} from "@heroicons/react/24/outline";
import { $getSelection, $isRangeSelection, LexicalEditor } from "lexical";

import "./ContextMenu.css";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useStore, PromptTypeKeys } from "../store";
import { useState } from "react";
import useCtrlHotkey from "../hooks/useCtrlHotkey";
import { useAIGeneration } from "../hooks/useAIGeneration";

interface Props {
  editor: LexicalEditor;
  hide: () => void;
}

export default function ContextMenu({ hide }: Props) {
  const [selectedPrompt, setSelectedPrompt] =
    useState<PromptTypeKeys>("newScene");
  const [customPrompt, setCustomPrompt] = useState("");
  const [editor] = useLexicalComposerContext();
  const stories = useStore((state) => state.stories);
  const activeStoryId = useStore((state) => state.activeStoryId);
  const { generate, canGenerate } = useAIGeneration();

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

  const handleGenerate = (promptTemplateKey: PromptTypeKeys) => {
    if (!canGenerate) return;

    generate(promptTemplateKey, customPrompt);
    // Clear the custom prompt after submitting
    setCustomPrompt("");
  };

  useCtrlHotkey(() => {
    handleGenerate("newScene");
  }, " ");

  return (
    <div className={"context-menu-container"}>
      <div className={"context-menu"}>
        <div className="custom-prompt-area">
          <input
            type="text"
            className="custom-prompt-input"
            placeholder="Tell me what you want to write about..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                hide();
                handleGenerate(selectedPrompt);
              }
            }}
          />
        </div>
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
              handleGenerate(selectedPrompt);
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
