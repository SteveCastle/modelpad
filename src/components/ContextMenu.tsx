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
} from "lexical";
import "./ContextMenu.css";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useStore } from "../store";

type PromptGenerator = (text: string) => string;
type PromptTypeKeys = "newScene" | "rewrite" | "summarize";

interface Props {
  editor: LexicalEditor;
  hide: () => void;
}

const promptGenerators: Record<PromptTypeKeys, PromptGenerator> = {
  newScene: (text: string) => {
    return `Write a new scene based on the following prompt:
     ${text}

     BEGIN SCENE:
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
  const host = useStore((state) => state.host);
  const modelSettings = useStore((state) => state.modelSettings);
  const { setGenerationState, updateContext } = useStore((state) => state);
  const stories = useStore((state) => state.stories);
  const activeStoryId = useStore((state) => state.activeStoryId);
  const activeStory = stories.find((s) => s.id === activeStoryId);
  const context = activeStory?.context;
  const [editor] = useLexicalComposerContext();
  function generate(promptTypeKey: PromptTypeKeys) {
    editor.update(() => {
      const root = $getRoot();
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const text = selection.getTextContent();
      const newParagraphNode = $createParagraphNode();
      root.append(newParagraphNode);
      const prompt = promptGenerators[promptTypeKey](text);
      console.log("fetching with context", context, prompt);
      setGenerationState("loading");
      fetch(`${host}/api/generate`, {
        signal: abortController?.signal,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelSettings.model,
          prompt,
          context: promptTypeKey === "newScene" ? context : undefined,
          options: {
            temperature: modelSettings.temperature,
            stop: modelSettings.stop,
          },
        }),
      })
        .then((response) => {
          if (!response || !response.body) {
            throw new Error("Invalid response");
          }
          const reader = response.body.getReader();
          setGenerationState("generating");
          return new ReadableStream({
            start(controller) {
              function push() {
                reader.read().then(({ done, value }) => {
                  if (done) {
                    controller.close();
                    return;
                  }
                  // Convert the Uint8Array to string and process the chunk
                  const chunk = new TextDecoder("utf-8").decode(value);
                  try {
                    const json = JSON.parse(chunk);
                    const response = json.response;
                    if (newParagraphNode && response) {
                      editor.update(() => {
                        const textNode = $createTextNode(response);
                        newParagraphNode.append(textNode);
                      });
                    }
                    if (json.context) {
                      updateContext(activeStoryId, json.context);
                      setGenerationState("idle");
                      console.log("set context", json.context);
                    }
                  } catch (e) {
                    console.log(e);
                  }
                  // Push the chunk to the stream
                  controller.enqueue(value);
                  push();
                });
              }
              push();
            },
          });
        })
        .then((stream) => new Response(stream))
        .then((response) => response.text())
        .then(() => {
          console.log("Complete");
        })
        .catch((err) => console.error(err));
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
