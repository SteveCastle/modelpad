"use client";
import {
  SparklesIcon,
  ArrowPathIcon,
  ArrowsPointingInIcon,
} from "@heroicons/react/24/outline";
import { $getSelection, $isRangeSelection, LexicalEditor } from "lexical";

import "./ContextMenu.css";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useStore } from "../store";
import { useState } from "react";
import { useAIGeneration } from "../hooks/useAIGeneration";

interface Props {
  editor: LexicalEditor;
  hide: () => void;
}

export default function ContextMenu({ hide }: Props) {
  const [selectedPromptId, setSelectedPromptId] = useState<string>("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [editor] = useLexicalComposerContext();
  const stories = useStore((state) => state.stories);
  const activeStoryId = useStore((state) => state.activeStoryId);
  const promptTemplates = useStore((state) => state.promptTemplates);
  const activePromptTemplateId = useStore(
    (state) => state.activePromptTemplateId
  );
  const { generate, canGenerate } = useAIGeneration();

  // Initialize selected prompt with active template
  useState(() => {
    if (!selectedPromptId && activePromptTemplateId) {
      setSelectedPromptId(activePromptTemplateId);
    }
  });

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

  const handleGenerate = (promptTemplateId: string) => {
    if (!canGenerate) return;

    // The hook builds prompt context from the editor; customPrompt text is already
    // included in the selected template. If you want to wire this as an editor's note,
    // store it separately in the global store and the hook will pull it in.
    generate(promptTemplateId);
    // Clear the custom prompt after submitting
    setCustomPrompt("");
  };

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
                handleGenerate(selectedPromptId || activePromptTemplateId);
              }
            }}
          />
        </div>
        <div className={"button-area"}>
          {promptTemplates.map((template, index) => {
            const isActive =
              selectedPromptId === template.id ||
              (!selectedPromptId && activePromptTemplateId === template.id);
            const IconComponent =
              index === 0
                ? SparklesIcon
                : index === 1
                ? ArrowPathIcon
                : ArrowsPointingInIcon;

            return (
              <button
                key={template.id}
                type="button"
                className={`prompt-button ${template.id}-button ${
                  isActive ? "active" : ""
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedPromptId(template.id);
                }}
                title={template.name}
              >
                <IconComponent aria-hidden="true" />
              </button>
            );
          })}
          <button
            type="button"
            className="generate-button"
            onClick={() => {
              hide();
              handleGenerate(selectedPromptId || activePromptTemplateId);
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
