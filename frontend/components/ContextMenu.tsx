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
import { useStore, PromptTypeKeys } from "../store";
import { providers } from "../providers";
import { PencilIcon } from "@heroicons/react/24/solid";
import { useEffect, useState } from "react";
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
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<PromptTypeKeys | null>(null); // ["newScene", "rewrite", "summarize"
  const abortController = useStore((state) => state.abortController);
  const {
    model,

    modelSettings,
    promptTemplates,
    systemPromptTemplates,
    ragPromptTemplates,
    changePromptTemplate,
    changeSystemPromptTemplate,
    changeRagPromptTemplate,
    useRag,
  } = useStore((state) => state);

  const { host, providerKey } = useStore(
    (state) => state.availableServers[state.serverKey]
  );
  const [editor] = useLexicalComposerContext();
  const { setGenerationState, updateContext } = useStore((state) => state);
  const stories = useStore((state) => state.stories);
  const activeStoryId = useStore((state) => state.activeStoryId);
  const activeStory = stories.find((s) => s.id === activeStoryId);
  const activeStoryMarkdown = activeStory?.content
    ? convertJSONToMarkdown(JSON.stringify(activeStory?.content) || "")
    : "";
  const inActiveStoryMarkdowns = stories
    .filter((story) => story.id !== activeStoryId && story.includeInContext)
    .map((s) => convertJSONToMarkdown(JSON.stringify(s.content)));
  const documents = inActiveStoryMarkdowns.concat(activeStoryMarkdown);

  const provider = providers[providerKey];

  //if editing becomes false clear the active tab
  useEffect(() => {
    if (!editing) {
      setActiveTab(null);
    }
  }, [editing]);

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

  function generate(promptTemplateKey: PromptTypeKeys) {
    if (!abortController || !model) return;
    editor.update(() => {
      const selection = $getSelection();
      const root = $getRoot();
      let text;
      if (!$isRangeSelection(selection)) {
        text = selection.getTextContent();
      } else {
        text = root.getTextContent();
      }

      const ragDocs = documents.join("\n").replace(text, "");
      const promptHeader = applyRagTemplate(
        ragPromptTemplates[promptTemplateKey],
        ragDocs
      );
      const prompt = applyTemplate(promptTemplates[promptTemplateKey], text);
      const promptWithHeader = promptHeader + "\n" + prompt;
      setGenerationState("loading");
      const newParagraphNode = $createParagraphNode();
      root.append(newParagraphNode);
      provider.generateText(
        promptWithHeader,
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
              activeTab === "newScene" ? "active" : ""
            }`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (editing) {
                setActiveTab("newScene");
                return;
              }
              hide();
              generate("newScene");
            }}
          >
            <SparklesIcon aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`rewrite-button ${
              activeTab === "rewrite" ? "active" : ""
            }`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (editing) {
                setActiveTab("rewrite");
                return;
              }
              generate("rewrite");
              hide();
            }}
          >
            <ArrowPathIcon aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`summarize-button ${
              activeTab === "summarize" ? "active" : ""
            }`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (editing) {
                setActiveTab("summarize");
                return;
              }
              generate("summarize");
              hide();
            }}
          >
            <ArrowsPointingInIcon aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`edit-button ${editing ? "active" : ""}`}
            onClick={() => {
              setActiveTab("newScene");
              setEditing((editing) => !editing);
            }}
          >
            <PencilIcon aria-hidden="true" />
          </button>
        </div>
        {editing && activeTab ? (
          <div className="editing-area">
            <span className="label">System Prompt</span>
            <textarea
              className="custom-scrollbar"
              value={systemPromptTemplates[activeTab]}
              onChange={(e) => {
                changeSystemPromptTemplate(activeTab, e.target.value);
              }}
            ></textarea>
            <span className="label">RAG Prefix</span>
            <textarea
              className="custom-scrollbar"
              value={ragPromptTemplates[activeTab]}
              onChange={(e) => {
                changeRagPromptTemplate(activeTab, e.target.value);
              }}
            ></textarea>
            <span className="label">Main Prompt Template</span>
            <textarea
              className="custom-scrollbar"
              value={promptTemplates[activeTab]}
              onChange={(e) => {
                changePromptTemplate(activeTab, e.target.value);
              }}
            ></textarea>
          </div>
        ) : null}
      </div>
      {editing ? (
        <span>
          <strong> Selected Text:</strong> &lt;text&gt;
          <strong> RAG Docs:</strong> &lt;docs&gt;
        </span>
      ) : (
        <span>CTRL+SPACE</span>
      )}
    </div>
  );
}
